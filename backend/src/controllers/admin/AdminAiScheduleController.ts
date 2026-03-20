import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ok, fail } from "../../utils/responses";
import { AIScheduleGeneratorService } from "../../services/scheduling/AIScheduleGeneratorService";
import { AdminMonthlyScheduleService } from "../../services/admin/AdminMonthlyScheduleService";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateOnlyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function parseISODateOnlyToUTC(value: string): Date | null {
  const trimmed = String(value ?? "").trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (!m) return null;
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) {
    return null;
  }
  if (mon < 1 || mon > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mon - 1, d, 0, 0, 0, 0));
}

function monthDatesUTC(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const out: Date[] = [];
  for (let d = new Date(first); d < nextMonth; d = new Date(d.getTime())) {
    out.push(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export class AdminAiScheduleController {
  constructor(
    private readonly generatorService: AIScheduleGeneratorService,
    private readonly monthlyScheduleService: AdminMonthlyScheduleService,
  ) {}

  generate = async (req: Request, res: Response) => {
    try {
      const {
        month,
        year,
        requirements,
        rules,
        workingDays,
        notes,
        holidays,
        teacherUnavailable,
        maxSeconds,
      } = req.body ?? {};

      const m = Number(month);
      const y = Number(year);

      const gen = await this.generatorService.generateMonthlySchedule({
        month: m,
        year: y,
        requirements: Array.isArray(requirements)
          ? requirements
          : Array.isArray(rules)
            ? rules
            : [],
        holidays: Array.isArray(holidays) ? holidays : [],
        workingDays: Array.isArray(workingDays) ? workingDays : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        teacherUnavailable: Array.isArray(teacherUnavailable)
          ? teacherUnavailable
          : [],
        maxSeconds:
          maxSeconds !== undefined && Number.isFinite(Number(maxSeconds))
            ? Number(maxSeconds)
            : undefined,
      });

      if (!gen.ok) {
        return fail(res, gen.status, gen.message);
      }

      // Save safely (no overwrites). If anything conflicts, we abort without writing.
      const saved = await this.monthlyScheduleService.bulkCreate(
        gen.generatedLessons.map((l) => ({
          date: String(l.date),
          timeSlotId: String(l.timeSlotId),
          groupId: String(l.groupId),
          teacherId: String(l.teacherId),
          subjectId: String(l.subjectId),
          roomId: l.roomId ? String(l.roomId) : null,
          note: l.note ? String(l.note) : null,
        })),
        { mode: "all_or_nothing" },
      );

      if (!saved.ok) {
        return fail(res, saved.status, saved.message);
      }

      return ok(res, "AI schedule generated", {
        generatedLessons: gen.generatedLessons,
        created: saved.data.created,
      });
    } catch (err: any) {
      return fail(res, 500, err?.message ?? "Failed to generate AI schedule");
    }
  };

  oneTapGenerate = async (req: Request, res: Response) => {
    try {
      const {
        month,
        year,
        cohortId,
        workingDays,
        holidays,
        notes,
        maxSeconds,
      } = req.body ?? {};

      const m = Number(month);
      const y = Number(year);

      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return fail(res, 400, "month must be 1..12");
      }
      if (!Number.isFinite(y) || y < 2000 || y > 2100) {
        return fail(res, 400, "year must be 2000..2100");
      }

      const wd = Array.isArray(workingDays)
        ? workingDays
            .map((v: any) => Number(v))
            .filter((v: number) => Number.isFinite(v) && v >= 0 && v <= 6)
        : [1, 2, 3, 4, 5, 6];

      const holidaysSet = new Set(
        (Array.isArray(holidays) ? holidays : [])
          .map((d: any) => String(d).trim())
          .filter((d: string) => !!parseISODateOnlyToUTC(d)),
      );

      const datesInMonth = monthDatesUTC(y, m)
        .filter((d) => (wd.length ? wd.includes(d.getUTCDay()) : true))
        .map(toISODateOnlyUTC)
        .filter((d) => !holidaysSet.has(d));

      if (!datesInMonth.length) {
        return fail(res, 400, "No available days in month");
      }

      const timeSlots = await prisma.timeSlot.findMany({
        where: { isBreak: false },
        select: { id: true },
        take: 200,
      });

      if (!timeSlots.length) {
        return fail(res, 400, "No non-break TimeSlots configured in DB");
      }

      const slotsPerDay = timeSlots.length;

      const groups = await prisma.group.findMany({
        where:
          typeof cohortId === "string" && cohortId.trim()
            ? { cohortId: cohortId.trim() }
            : {},
        select: { id: true },
        take: 500,
      });

      if (!groups.length) {
        return fail(res, 404, "No groups found");
      }

      const groupIds = groups.map((g) => g.id);

      const gradeBooks = await prisma.gradeBook.findMany({
        where: { groupId: { in: groupIds } },
        select: { groupId: true, subjectId: true },
        take: 20_000,
      });

      if (!gradeBooks.length) {
        return fail(
          res,
          400,
          "No GradeBooks found. One tap uses GradeBooks (group-subject mapping).",
        );
      }

      const subjectIds = Array.from(
        new Set(gradeBooks.map((gb) => gb.subjectId)),
      );
      const subjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: {
          id: true,
          teachers: {
            select: { id: true, fullName: true },
            orderBy: { fullName: "asc" },
            take: 1,
          },
        },
        take: 20_000,
      });

      const teacherIdBySubjectId = new Map<string, string>();
      const missingTeachers: string[] = [];
      for (const s of subjects) {
        const t = s.teachers?.[0];
        if (t?.id) teacherIdBySubjectId.set(s.id, t.id);
        else missingTeachers.push(s.id);
      }

      const gradeBooksByGroup = new Map<string, Array<{ subjectId: string }>>();
      for (const gb of gradeBooks) {
        const list = gradeBooksByGroup.get(gb.groupId) ?? [];
        list.push({ subjectId: gb.subjectId });
        gradeBooksByGroup.set(gb.groupId, list);
      }

      const existingCounts = await prisma.schedule.groupBy({
        by: ["groupId"],
        where: {
          calendarDay: { year: y, month: m },
          groupId: { in: groupIds },
        },
        _count: { _all: true },
      });

      const existingByGroup = new Map<string, number>();
      for (const row of existingCounts) {
        existingByGroup.set(row.groupId, row._count._all);
      }

      const requirements: Array<{
        groupId: string;
        subjectId: string;
        teacherId: string;
        roomId?: string | null;
        lessons: number;
      }> = [];

      let groupsUsed = 0;
      let groupsSkippedNoTeacher = 0;
      let groupsSkippedNoCapacity = 0;

      for (const groupId of groupIds) {
        const rows = gradeBooksByGroup.get(groupId) ?? [];
        const uniqueSubjectIds = Array.from(
          new Set(rows.map((r) => r.subjectId)),
        );

        const subjectTeacherPairs = uniqueSubjectIds
          .map((subjectId) => ({
            subjectId,
            teacherId: teacherIdBySubjectId.get(subjectId) ?? null,
          }))
          .filter(
            (x): x is { subjectId: string; teacherId: string } =>
              typeof x.teacherId === "string" && !!x.teacherId,
          );

        if (!subjectTeacherPairs.length) {
          groupsSkippedNoTeacher++;
          continue;
        }

        const totalSlots = datesInMonth.length * slotsPerDay;
        const existing = existingByGroup.get(groupId) ?? 0;
        const capacity = Math.max(0, totalSlots - existing);
        if (capacity <= 0) {
          groupsSkippedNoCapacity++;
          continue;
        }

        const n = subjectTeacherPairs.length;
        const base = Math.floor(capacity / n);
        let rem = capacity - base * n;

        for (const pair of subjectTeacherPairs) {
          const lessons = base + (rem > 0 ? 1 : 0);
          if (rem > 0) rem -= 1;
          if (lessons <= 0) continue;
          requirements.push({
            groupId,
            subjectId: pair.subjectId,
            teacherId: pair.teacherId,
            roomId: null,
            lessons,
          });
        }

        groupsUsed++;
      }

      if (!requirements.length) {
        return fail(
          res,
          400,
          "No requirements could be inferred (missing teachers or no capacity)",
        );
      }

      const gen = await this.generatorService.generateMonthlySchedule({
        month: m,
        year: y,
        requirements,
        holidays: Array.from(holidaysSet),
        workingDays: wd,
        notes: typeof notes === "string" ? notes : undefined,
        maxSeconds:
          maxSeconds !== undefined && Number.isFinite(Number(maxSeconds))
            ? Number(maxSeconds)
            : undefined,
      });

      if (!gen.ok) {
        return fail(res, gen.status, gen.message);
      }

      const saved = await this.monthlyScheduleService.bulkCreate(
        gen.generatedLessons.map((l) => ({
          date: String(l.date),
          timeSlotId: String(l.timeSlotId),
          groupId: String(l.groupId),
          teacherId: String(l.teacherId),
          subjectId: String(l.subjectId),
          roomId: l.roomId ? String(l.roomId) : null,
          note: l.note ? String(l.note) : null,
        })),
        { mode: "all_or_nothing" },
      );

      if (!saved.ok) {
        return fail(res, saved.status, saved.message);
      }

      return ok(res, "AI one-tap schedule generated", {
        created: saved.data.created,
        meta: {
          month: m,
          year: y,
          workingDays: wd,
          days: datesInMonth.length,
          slotsPerDay,
          groupsUsed,
          groupsSkippedNoTeacher,
          groupsSkippedNoCapacity,
          requirements: requirements.length,
          subjectsMissingTeachers: missingTeachers.length,
        },
      });
    } catch (err: any) {
      return fail(
        res,
        500,
        err?.message ?? "Failed to one-tap generate AI schedule",
      );
    }
  };
}
