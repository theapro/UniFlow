import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

function clampISODate(value: string): string {
  const v = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("INVALID_DATE");
  return v;
}

function dateToISODateUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayStartUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

function nextDayStartUTC(iso: string): Date {
  const dt = dayStartUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt;
}

function weekdayFromDateUTC(
  d: Date,
): "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" {
  const day = d.getUTCDay();
  switch (day) {
    case 0:
      return "SUN";
    case 1:
      return "MON";
    case 2:
      return "TUE";
    case 3:
      return "WED";
    case 4:
      return "THU";
    case 5:
      return "FRI";
    case 6:
      return "SAT";
    default:
      return "MON";
  }
}

function assertCohortMatch(groupCohortId: string | null, cohortId?: string) {
  if (!cohortId) return;
  if (!groupCohortId) throw new Error("COHORT_MISMATCH");
  if (groupCohortId !== cohortId) throw new Error("COHORT_MISMATCH");
}

function isValidAttendanceStatus(v: string): v is AttendanceStatus {
  const value = String(v ?? "")
    .trim()
    .toUpperCase();
  return (
    value === "PRESENT" ||
    value === "ABSENT" ||
    value === "LATE" ||
    value === "EXCUSED"
  );
}

function normalizeAttendanceStatus(v: string): AttendanceStatus {
  const raw = String(v ?? "").trim();
  if (!raw) throw new Error("INVALID_STATUS");

  const upper = raw.toUpperCase();
  if (upper === "P") return "PRESENT";
  if (upper === "A") return "ABSENT";
  if (upper === "L") return "LATE";
  if (upper === "E") return "EXCUSED";

  if (isValidAttendanceStatus(raw))
    return raw.toUpperCase() as AttendanceStatus;
  throw new Error("INVALID_STATUS");
}

function normalizeGradeValue(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw new Error("INVALID_GRADE");
  const i = Math.floor(n);
  if (i < 0 || i > 5) throw new Error("INVALID_GRADE");
  return i;
}

function parseTimeToParts(
  value: string | Date | null | undefined,
): { hh: number; mm: number } | null {
  if (value instanceof Date) {
    const hh = value.getUTCHours();
    const mm = value.getUTCMinutes();
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }

  const v = String(value ?? "").trim();
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function dateAtUTC(dateOnly: Date, hh: number, mm: number): Date {
  return new Date(
    Date.UTC(
      dateOnly.getUTCFullYear(),
      dateOnly.getUTCMonth(),
      dateOnly.getUTCDate(),
      hh,
      mm,
      0,
      0,
    ),
  );
}

export class AdminAttendanceGradesService {
  async getMeta() {
    const [cohorts, groups, subjects, weeklyPairs, monthlyPairs] =
      await Promise.all([
        prisma.cohort.findMany({
          orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
          select: { id: true, code: true, sortOrder: true, year: true },
          take: 2000,
        }),
        prisma.group.findMany({
          select: { id: true, name: true, cohortId: true },
          take: 10000,
          orderBy: { name: "asc" },
        }),
        prisma.subject.findMany({
          select: { id: true, name: true, cohortId: true },
          take: 10000,
          orderBy: { name: "asc" },
        }),
        prisma.scheduleEntry.findMany({
          select: { groupId: true, subjectId: true },
          distinct: ["groupId", "subjectId"],
          take: 200000,
        }),
        prisma.schedule.findMany({
          select: { groupId: true, subjectId: true },
          distinct: ["groupId", "subjectId"],
          take: 200000,
        }),
      ]);

    const unique = new Map<string, { groupId: string; subjectId: string }>();
    for (const p of [...weeklyPairs, ...monthlyPairs]) {
      const key = `${p.groupId}@@${p.subjectId}`;
      if (!unique.has(key)) unique.set(key, p);
    }

    const schedulePairs = Array.from(unique.values());

    return { cohorts, groups, subjects, schedulePairs };
  }

  async getAttendanceTable(opts: {
    cohortId?: string;
    groupId: string;
    subjectId: string;
    from: string;
    to: string;
  }) {
    const from = clampISODate(opts.from);
    const to = clampISODate(opts.to);
    if (to < from) throw new Error("INVALID_RANGE");

    const group = await prisma.group.findUnique({
      where: { id: opts.groupId },
      select: { id: true, name: true, cohortId: true },
    });
    if (!group) throw new Error("GROUP_NOT_FOUND");
    assertCohortMatch(group.cohortId ?? null, opts.cohortId);

    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
      select: { id: true, name: true },
    });
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const students = await prisma.student.findMany({
      where: {
        studentGroups: {
          some: {
            groupId: group.id,
            OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, fullName: true, studentNumber: true },
      orderBy: [{ studentNumber: "asc" }, { fullName: "asc" }],
      take: 5000,
    });

    const [scheduleEntries, calendarDays] = await Promise.all([
      prisma.scheduleEntry.findMany({
        where: {
          groupId: group.id,
          subjectId: subject.id,
          OR: [
            { effectiveFrom: null, effectiveTo: null },
            {
              AND: [
                {
                  OR: [
                    { effectiveFrom: null },
                    { effectiveFrom: { lte: dayStartUTC(to) } },
                  ],
                },
                {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: dayStartUTC(from) } },
                  ],
                },
              ],
            },
          ],
        },
        select: { weekday: true, effectiveFrom: true, effectiveTo: true },
        take: 200,
      }),
      prisma.calendarDay.findMany({
        where: {
          date: { gte: dayStartUTC(from), lt: nextDayStartUTC(to) },
          schedules: {
            some: {
              groupId: group.id,
              subjectId: subject.id,
            },
          },
        },
        select: { date: true },
        orderBy: { date: "asc" },
        take: 2000,
      }),
    ]);

    let dates: string[] = [];

    const monthlyDates = calendarDays
      .map((d) => dateToISODateUTC(d.date))
      .filter((iso) => iso >= from && iso <= to);

    if (monthlyDates.length > 0) {
      dates = monthlyDates.slice(0, 62);
    } else {
      const out: string[] = [];
      let cur = from;
      while (cur <= to) {
        const dt = dayStartUTC(cur);
        const weekday = weekdayFromDateUTC(dt);

        const isScheduled = scheduleEntries.some((e) => {
          if (e.weekday !== (weekday as any)) return false;
          if (
            e.effectiveFrom &&
            dt < dayStartUTC(dateToISODateUTC(e.effectiveFrom))
          )
            return false;
          if (
            e.effectiveTo &&
            dt > dayStartUTC(dateToISODateUTC(e.effectiveTo))
          )
            return false;
          return true;
        });

        if (isScheduled) out.push(cur);

        dt.setUTCDate(dt.getUTCDate() + 1);
        cur = dateToISODateUTC(dt);
        if (out.length > 62) break;
      }
      dates = out;
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        groupId: group.id,
        subjectId: subject.id,
        startsAt: { gte: dayStartUTC(from), lt: nextDayStartUTC(to) },
      },
      select: { id: true, startsAt: true },
      orderBy: { startsAt: "asc" },
      take: 5000,
    });

    const lessonIdByDate = new Map<string, string>();
    for (const l of lessons) {
      const iso = dateToISODateUTC(l.startsAt);
      if (iso < from || iso > to) continue;
      if (!lessonIdByDate.has(iso)) lessonIdByDate.set(iso, l.id);
    }

    const lessonIds = Array.from(new Set(Array.from(lessonIdByDate.values())));

    const attendance = lessonIds.length
      ? await prisma.attendance.findMany({
          where: { lessonId: { in: lessonIds } },
          select: { lessonId: true, studentId: true, status: true },
          take: 200000,
        })
      : [];

    const statusByLessonStudent = new Map<string, AttendanceStatus>();
    for (const a of attendance) {
      statusByLessonStudent.set(`${a.lessonId}@@${a.studentId}`, a.status);
    }

    const rows = students.map((s) => {
      const cells: Record<string, AttendanceStatus | null> = {};
      for (const date of dates) {
        const lessonId = lessonIdByDate.get(date);
        if (!lessonId) {
          cells[date] = null;
          continue;
        }
        cells[date] = statusByLessonStudent.get(`${lessonId}@@${s.id}`) ?? null;
      }
      return {
        studentId: s.id,
        studentNumber: s.studentNumber ?? "",
        fullName: s.fullName,
        cells,
      };
    });

    return {
      cohortId: opts.cohortId ?? null,
      group: { id: group.id, name: group.name },
      subject: { id: subject.id, name: subject.name },
      dates,
      rows,
    };
  }

  async saveAttendanceTable(opts: {
    cohortId?: string;
    groupId: string;
    subjectId: string;
    dates: unknown[];
    records: unknown[];
  }) {
    const group = await prisma.group.findUnique({
      where: { id: opts.groupId },
      select: { id: true, cohortId: true },
    });
    if (!group) throw new Error("GROUP_NOT_FOUND");
    assertCohortMatch(group.cohortId ?? null, opts.cohortId);

    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
      select: { id: true, teachers: { select: { id: true }, take: 1 } },
    });
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const dates = (opts.dates ?? []).map((d) => clampISODate(String(d ?? "")));
    const uniqueDates = Array.from(new Set(dates));

    const parsed = (opts.records ?? []).map((r: any) => {
      const studentId = String(r?.studentId ?? "").trim();
      const date = clampISODate(String(r?.date ?? ""));
      const status = normalizeAttendanceStatus(String(r?.status ?? ""));
      if (!studentId) throw new Error("INVALID_STATUS");
      return { studentId, date, status };
    });

    const studentIds = Array.from(new Set(parsed.map((p) => p.studentId)));
    const allowed = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        studentGroups: { some: { groupId: group.id, leftAt: null } },
      },
      select: { id: true },
      take: 10000,
    });
    const allowedSet = new Set(allowed.map((s) => s.id));

    const byDate = new Map<
      string,
      Array<{ studentId: string; status: AttendanceStatus }>
    >();
    for (const p of parsed) {
      if (!allowedSet.has(p.studentId)) continue;
      const list = byDate.get(p.date) ?? [];
      list.push({ studentId: p.studentId, status: p.status });
      byDate.set(p.date, list);
    }

    const results: Array<{ date: string; upserted: number }> = [];

    for (const date of uniqueDates) {
      const list = byDate.get(date) ?? [];
      if (list.length === 0) {
        results.push({ date, upserted: 0 });
        continue;
      }

      const dayStart = dayStartUTC(date);
      const dayEnd = nextDayStartUTC(date);

      let lesson = await prisma.lesson.findFirst({
        where: {
          groupId: group.id,
          subjectId: subject.id,
          startsAt: { gte: dayStart, lt: dayEnd },
        },
        select: { id: true },
        orderBy: { startsAt: "asc" },
      });

      if (!lesson) {
        const scheduleRow = await prisma.schedule.findFirst({
          where: {
            groupId: group.id,
            subjectId: subject.id,
            calendarDay: { date: { gte: dayStart, lt: dayEnd } },
          },
          select: {
            teacherId: true,
            room: { select: { name: true } },
            timeSlot: {
              select: { slotNumber: true, startTime: true, endTime: true },
            },
          },
          orderBy: { timeSlot: { slotNumber: "asc" } },
        });

        const teacherId = scheduleRow?.teacherId ?? subject.teachers?.[0]?.id;
        if (!teacherId) throw new Error("SUBJECT_NOT_FOUND");

        const startParts = parseTimeToParts(
          scheduleRow?.timeSlot?.startTime ?? null,
        );
        const endParts = parseTimeToParts(
          scheduleRow?.timeSlot?.endTime ?? null,
        );

        const startsAt = startParts
          ? dateAtUTC(dayStart, startParts.hh, startParts.mm)
          : dateAtUTC(dayStart, 9, 0);
        const endsAt = endParts
          ? dateAtUTC(dayStart, endParts.hh, endParts.mm)
          : dateAtUTC(dayStart, 10, 0);

        lesson = await prisma.lesson.create({
          data: {
            startsAt,
            endsAt,
            room: scheduleRow?.room?.name ?? null,
            groupId: group.id,
            teacherId,
            subjectId: subject.id,
          },
          select: { id: true },
        });
      }

      const ops = list.map((rec) =>
        prisma.attendance.upsert({
          where: {
            lessonId_studentId: {
              lessonId: lesson!.id,
              studentId: rec.studentId,
            },
          },
          update: { status: rec.status },
          create: {
            lessonId: lesson!.id,
            studentId: rec.studentId,
            status: rec.status,
          },
        }),
      );

      await prisma.$transaction(ops);
      results.push({ date, upserted: ops.length });
    }

    return { saved: results.length, results };
  }

  async getGradesTable(opts: {
    cohortId?: string;
    groupId: string;
    subjectId: string;
    from?: string;
    to?: string;
  }) {
    const from = opts.from ? clampISODate(opts.from) : null;
    const to = opts.to ? clampISODate(opts.to) : null;
    if (from && to && to < from) throw new Error("INVALID_RANGE");

    const group = await prisma.group.findUnique({
      where: { id: opts.groupId },
      select: { id: true, name: true, cohortId: true },
    });
    if (!group) throw new Error("GROUP_NOT_FOUND");
    assertCohortMatch(group.cohortId ?? null, opts.cohortId);

    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
      select: { id: true, name: true },
    });
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const students = await prisma.student.findMany({
      where: {
        studentGroups: {
          some: {
            groupId: group.id,
            OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
          },
        },
      },
      select: { id: true, fullName: true, studentNumber: true },
      orderBy: [{ studentNumber: "asc" }, { fullName: "asc" }],
      take: 5000,
    });

    const gradeBook = await prisma.gradeBook.findUnique({
      where: {
        groupId_subjectId: { groupId: group.id, subjectId: subject.id },
      },
      select: { id: true, assignmentCount: true },
    });

    let generatedCount: number | null = null;
    if (from && to) {
      const calendarDays = await prisma.calendarDay.findMany({
        where: {
          date: { gte: dayStartUTC(from), lt: nextDayStartUTC(to) },
          schedules: {
            some: {
              groupId: group.id,
              subjectId: subject.id,
            },
          },
        },
        select: { date: true },
        take: 1000,
      });

      if (calendarDays.length > 0) {
        generatedCount = Math.min(Math.max(calendarDays.length, 1), 200);
      } else {
        const scheduleEntries = await prisma.scheduleEntry.findMany({
          where: {
            groupId: group.id,
            subjectId: subject.id,
            OR: [
              { effectiveFrom: null, effectiveTo: null },
              {
                AND: [
                  {
                    OR: [
                      { effectiveFrom: null },
                      { effectiveFrom: { lte: dayStartUTC(to) } },
                    ],
                  },
                  {
                    OR: [
                      { effectiveTo: null },
                      { effectiveTo: { gte: dayStartUTC(from) } },
                    ],
                  },
                ],
              },
            ],
          },
          select: { weekday: true, effectiveFrom: true, effectiveTo: true },
          take: 200,
        });

        let count = 0;
        let cur = from;
        while (cur <= to) {
          const dt = dayStartUTC(cur);
          const weekday = weekdayFromDateUTC(dt);
          const isScheduled = scheduleEntries.some((e) => {
            if (e.weekday !== (weekday as any)) return false;
            if (
              e.effectiveFrom &&
              dt < dayStartUTC(dateToISODateUTC(e.effectiveFrom))
            )
              return false;
            if (
              e.effectiveTo &&
              dt > dayStartUTC(dateToISODateUTC(e.effectiveTo))
            )
              return false;
            return true;
          });
          if (isScheduled) count += 1;
          dt.setUTCDate(dt.getUTCDate() + 1);
          cur = dateToISODateUTC(dt);
          if (count > 200) break;
        }

        generatedCount = Math.max(count, 1);
      }
    }

    const assignmentCount = Math.max(
      generatedCount ?? gradeBook?.assignmentCount ?? 0,
      1,
    );

    const records = gradeBook
      ? await prisma.gradeRecord.findMany({
          where: { gradeBookId: gradeBook.id },
          select: {
            studentId: true,
            assignmentIndex: true,
            rawValue: true,
            score: true,
          },
          take: 500000,
        })
      : [];

    const byStudent = new Map<string, Map<number, number | null>>();
    for (const r of records) {
      const stMap =
        byStudent.get(r.studentId) ?? new Map<number, number | null>();
      const v =
        typeof r.score === "number" && Number.isFinite(r.score)
          ? Math.round(r.score)
          : null;
      stMap.set(r.assignmentIndex, v);
      byStudent.set(r.studentId, stMap);
    }

    const rows = students.map((s) => {
      const st = byStudent.get(s.id) ?? new Map<number, number | null>();
      const cells: Record<string, number | null> = {};
      for (let i = 1; i <= assignmentCount; i += 1) {
        cells[String(i)] = st.get(i) ?? null;
      }
      return {
        studentId: s.id,
        studentNumber: s.studentNumber ?? "",
        fullName: s.fullName,
        cells,
      };
    });

    const columns = Array.from({ length: assignmentCount }, (_, i) =>
      String(i + 1),
    );

    return {
      cohortId: opts.cohortId ?? null,
      group: { id: group.id, name: group.name },
      subject: { id: subject.id, name: subject.name },
      assignmentCount,
      columns,
      rows,
    };
  }

  async saveGradesTable(opts: {
    cohortId?: string;
    groupId: string;
    subjectId: string;
    assignmentCount: number;
    records: unknown[];
  }) {
    const count = Math.floor(Number(opts.assignmentCount));
    if (!Number.isFinite(count) || count <= 0 || count > 200) {
      throw new Error("INVALID_ASSIGNMENT_COUNT");
    }

    const group = await prisma.group.findUnique({
      where: { id: opts.groupId },
      select: { id: true, cohortId: true },
    });
    if (!group) throw new Error("GROUP_NOT_FOUND");
    assertCohortMatch(group.cohortId ?? null, opts.cohortId);

    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
      select: { id: true },
    });
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const gradeBook = await prisma.gradeBook.upsert({
      where: {
        groupId_subjectId: { groupId: group.id, subjectId: subject.id },
      },
      create: {
        groupId: group.id,
        subjectId: subject.id,
        assignmentCount: count,
        source: "WEB",
      },
      update: {
        assignmentCount: count,
        source: "WEB",
      },
      select: { id: true },
    });

    const parsed = (opts.records ?? []).map((r: any) => {
      const studentId = String(r?.studentId ?? "").trim();
      const assignmentIndex = Math.floor(Number(r?.assignmentIndex));
      if (
        !studentId ||
        !Number.isFinite(assignmentIndex) ||
        assignmentIndex < 1 ||
        assignmentIndex > count
      ) {
        throw new Error("INVALID_GRADE");
      }
      const grade = normalizeGradeValue(r?.grade);
      return { studentId, assignmentIndex, grade };
    });

    const studentIds = Array.from(new Set(parsed.map((p) => p.studentId)));
    const allowed = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        studentGroups: {
          some: {
            groupId: group.id,
            OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
          },
        },
      },
      select: { id: true },
      take: 10000,
    });
    const allowedSet = new Set(allowed.map((s) => s.id));

    const tx: any[] = [];
    for (const p of parsed) {
      if (!allowedSet.has(p.studentId)) continue;

      if (p.grade === null) {
        tx.push(
          prisma.gradeRecord.deleteMany({
            where: {
              gradeBookId: gradeBook.id,
              studentId: p.studentId,
              assignmentIndex: p.assignmentIndex,
            },
          }),
        );
      } else {
        tx.push(
          prisma.gradeRecord.upsert({
            where: {
              gradeBookId_studentId_assignmentIndex: {
                gradeBookId: gradeBook.id,
                studentId: p.studentId,
                assignmentIndex: p.assignmentIndex,
              },
            },
            update: { score: p.grade, rawValue: String(p.grade) },
            create: {
              gradeBookId: gradeBook.id,
              studentId: p.studentId,
              assignmentIndex: p.assignmentIndex,
              score: p.grade,
              rawValue: String(p.grade),
            },
          }),
        );
      }
    }

    const CHUNK = 1000;
    for (let i = 0; i < tx.length; i += CHUNK) {
      await prisma.$transaction(tx.slice(i, i + CHUNK));
    }

    return { updated: tx.length };
  }
}
