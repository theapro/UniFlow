import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { formatDbTime } from "../../utils/time";
import { getWeekdayUTC } from "../../utils/weekday";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateOnlyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

export function parseISODateOnlyToUTC(value: string): Date | null {
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

function isUniqueConstraintError(
  err: any,
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err?.name === "PrismaClientKnownRequestError" &&
    typeof err?.code === "string"
  );
}

function isKnownRequestError(
  err: any,
): err is Prisma.PrismaClientKnownRequestError {
  return (
    err?.name === "PrismaClientKnownRequestError" &&
    typeof err?.code === "string"
  );
}

function formatForeignKeyMessage(err: Prisma.PrismaClientKnownRequestError) {
  const field = (err as any)?.meta?.field_name;
  if (typeof field === "string" && field.trim()) {
    return `Invalid reference: ${field}`;
  }
  return "Invalid reference id";
}

async function validateScheduleRefs(input: {
  timeSlotId?: string;
  groupId?: string;
  teacherId?: string;
  subjectId?: string;
  roomId?: string | null;
}) {
  const errors: string[] = [];

  if (input.timeSlotId !== undefined) {
    const raw = String(input.timeSlotId ?? "").trim();
    const missing = /^missing:(\d+)$/.exec(raw);
    if (missing) {
      errors.push(`TimeSlot is not configured for slot #${missing[1]}`);
    } else {
      const ok = await prisma.timeSlot.findUnique({
        where: { id: raw },
        select: { id: true },
      });
      if (!ok) errors.push("TimeSlot not found");
    }
  }

  if (input.groupId !== undefined) {
    const ok = await prisma.group.findUnique({
      where: { id: input.groupId },
      select: { id: true },
    });
    if (!ok) errors.push("Group not found");
  }

  if (input.teacherId !== undefined) {
    const ok = await prisma.teacher.findUnique({
      where: { id: input.teacherId },
      select: { id: true },
    });
    if (!ok) errors.push("Teacher not found");
  }

  if (input.subjectId !== undefined) {
    const ok = await prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!ok) errors.push("Subject not found");
  }

  if (input.roomId !== undefined) {
    if (input.roomId !== null) {
      const ok = await prisma.room.findUnique({
        where: { id: input.roomId },
        select: { id: true },
      });
      if (!ok) errors.push("Room not found");
    }
  }

  return errors;
}

type ConflictKind = "TEACHER" | "GROUP" | "ROOM";
type TxClient = Prisma.TransactionClient;

async function detectScheduleConflict(
  tx: TxClient,
  input: {
    calendarDayId: string;
    timeSlotId: string;
    groupId: string;
    teacherId: string;
    subjectId: string;
    roomId: string | null;
    note: string | null;
  },
  opts?: { excludeId?: string },
): Promise<ConflictKind | null> {
  const excludeId = opts?.excludeId;

  // Group: always strict (a group can't have 2 lessons in the same slot).
  {
    const existing = await tx.schedule.findFirst({
      where: {
        calendarDayId: input.calendarDayId,
        timeSlotId: input.timeSlotId,
        groupId: input.groupId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) return "GROUP";
  }

  // Teacher: strict (a teacher can't have 2 lessons in the same slot).
  {
    const existing = await tx.schedule.findFirst({
      where: {
        calendarDayId: input.calendarDayId,
        timeSlotId: input.timeSlotId,
        teacherId: input.teacherId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) return "TEACHER";
  }

  // Room: strict (a room can't have 2 lessons in the same slot).
  if (input.roomId) {
    const existing = await tx.schedule.findFirst({
      where: {
        calendarDayId: input.calendarDayId,
        timeSlotId: input.timeSlotId,
        roomId: input.roomId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) return "ROOM";
  }

  return null;
}

function classifyScheduleConflict(
  err: any,
): "TEACHER" | "GROUP" | "ROOM" | null {
  if (!isUniqueConstraintError(err)) return null;
  if (err.code !== "P2002") return null;

  const target = (err as any)?.meta?.target;
  const targetStr = Array.isArray(target) ? target.join(",") : String(target);

  const message = String(err?.message ?? "");

  const haystack = `${targetStr} ${message}`.toLowerCase();
  if (
    haystack.includes("teacher_schedule_conflict") ||
    haystack.includes("teacherid")
  ) {
    return "TEACHER";
  }
  if (
    haystack.includes("group_schedule_conflict") ||
    haystack.includes("groupid")
  ) {
    return "GROUP";
  }
  if (
    haystack.includes("room_schedule_conflict") ||
    haystack.includes("roomid")
  ) {
    return "ROOM";
  }
  return null;
}

export type CreateMonthlyScheduleInput = {
  date: string; // YYYY-MM-DD
  timeSlotId: string;
  groupId: string;
  teacherId: string;
  subjectId: string;
  roomId?: string | null;
  note?: string | null;
};

export type UpdateMonthlyScheduleInput = {
  date?: string; // YYYY-MM-DD
  timeSlotId?: string;
  groupId?: string;
  teacherId?: string;
  subjectId?: string;
  roomId?: string | null;
  note?: string | null;
};

type BulkCreateMode = "all_or_nothing" | "partial";

async function validateScheduleRefsBulk(inputs: CreateMonthlyScheduleInput[]) {
  const errors: string[] = [];

  const timeSlotIds = new Set<string>();
  const groupIds = new Set<string>();
  const teacherIds = new Set<string>();
  const subjectIds = new Set<string>();
  const roomIds = new Set<string>();

  for (const input of inputs) {
    const rawTs = String(input.timeSlotId ?? "").trim();
    const missing = /^missing:(\d+)$/.exec(rawTs);
    if (missing) {
      errors.push(`TimeSlot is not configured for slot #${missing[1]}`);
    } else if (rawTs) {
      timeSlotIds.add(rawTs);
    }

    if (input.groupId) groupIds.add(input.groupId);
    if (input.teacherId) teacherIds.add(input.teacherId);
    if (input.subjectId) subjectIds.add(input.subjectId);
    if (input.roomId) roomIds.add(input.roomId);
  }

  const [ts, groups, teachers, subjects, rooms] = await Promise.all([
    timeSlotIds.size
      ? prisma.timeSlot.findMany({
          where: { id: { in: Array.from(timeSlotIds) } },
          select: { id: true },
          take: 1000,
        })
      : Promise.resolve([] as Array<{ id: string }>),
    groupIds.size
      ? prisma.group.findMany({
          where: { id: { in: Array.from(groupIds) } },
          select: { id: true },
          take: 2000,
        })
      : Promise.resolve([] as Array<{ id: string }>),
    teacherIds.size
      ? prisma.teacher.findMany({
          where: { id: { in: Array.from(teacherIds) } },
          select: { id: true },
          take: 2000,
        })
      : Promise.resolve([] as Array<{ id: string }>),
    subjectIds.size
      ? prisma.subject.findMany({
          where: { id: { in: Array.from(subjectIds) } },
          select: { id: true },
          take: 2000,
        })
      : Promise.resolve([] as Array<{ id: string }>),
    roomIds.size
      ? prisma.room.findMany({
          where: { id: { in: Array.from(roomIds) } },
          select: { id: true },
          take: 2000,
        })
      : Promise.resolve([] as Array<{ id: string }>),
  ]);

  const tsSet = new Set(ts.map((x) => x.id));
  const groupSet = new Set(groups.map((x) => x.id));
  const teacherSet = new Set(teachers.map((x) => x.id));
  const subjectSet = new Set(subjects.map((x) => x.id));
  const roomSet = new Set(rooms.map((x) => x.id));

  for (const id of timeSlotIds)
    if (!tsSet.has(id)) errors.push("TimeSlot not found");
  for (const id of groupIds)
    if (!groupSet.has(id)) errors.push("Group not found");
  for (const id of teacherIds)
    if (!teacherSet.has(id)) errors.push("Teacher not found");
  for (const id of subjectIds)
    if (!subjectSet.has(id)) errors.push("Subject not found");
  for (const id of roomIds) if (!roomSet.has(id)) errors.push("Room not found");

  return errors;
}

export class AdminMonthlyScheduleService {
  async listMonths() {
    const rows = await prisma.calendarDay.groupBy({
      by: ["year", "month"],
      where: {
        schedules: {
          some: {},
        },
      },
      _count: {
        _all: true,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return rows.map((r) => ({
      year: r.year,
      month: r.month,
      days: r._count._all,
    }));
  }

  async list(params: {
    month: number;
    year: number;
    groupId?: string;
    teacherId?: string;
  }) {
    const where: Prisma.ScheduleWhereInput = {
      calendarDay: {
        month: params.month,
        year: params.year,
      },
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.teacherId ? { teacherId: params.teacherId } : {}),
    };

    const rows = await prisma.schedule.findMany({
      where,
      include: {
        calendarDay: true,
        timeSlot: true,
        group: true,
        teacher: true,
        subject: true,
        room: true,
      },
      orderBy: [
        { calendarDay: { date: "asc" } },
        { timeSlot: { slotNumber: "asc" } },
        { group: { name: "asc" } },
      ],
      take: 20000,
    });

    return rows.map((r) => ({
      ...r,
      date: toISODateOnlyUTC(r.calendarDay.date),
      weekday: r.calendarDay.weekday,
      timeSlot: r.timeSlot
        ? {
            ...r.timeSlot,
            startTime: formatDbTime(r.timeSlot.startTime),
            endTime: formatDbTime(r.timeSlot.endTime),
          }
        : r.timeSlot,
    }));
  }

  async create(input: CreateMonthlyScheduleInput) {
    // Validate refs up-front so we return a precise message (not a generic FK error).
    const refErrors = await validateScheduleRefs({
      timeSlotId: input.timeSlotId,
      groupId: input.groupId,
      teacherId: input.teacherId,
      subjectId: input.subjectId,
      roomId: input.roomId ?? null,
    });
    if (refErrors.length) {
      return {
        ok: false as const,
        status: 400,
        message: refErrors.join(", "),
      };
    }

    const dateUtc = parseISODateOnlyToUTC(input.date);
    if (!dateUtc) {
      return { ok: false as const, status: 400, message: "Invalid date" };
    }

    const month = dateUtc.getUTCMonth() + 1;
    const year = dateUtc.getUTCFullYear();
    const weekday = getWeekdayUTC(dateUtc);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const calendarDay = await tx.calendarDay.upsert({
          where: { date: dateUtc },
          create: {
            date: dateUtc,
            weekday,
            month,
            year,
          },
          update: {
            weekday,
            month,
            year,
          },
        });

        const conflict = await detectScheduleConflict(tx, {
          calendarDayId: calendarDay.id,
          timeSlotId: input.timeSlotId,
          groupId: input.groupId,
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          roomId: input.roomId ?? null,
          note: input.note ?? null,
        });

        if (conflict) {
          return { kind: "conflict" as const, conflict };
        }

        const row = await tx.schedule.create({
          data: {
            calendarDayId: calendarDay.id,
            timeSlotId: input.timeSlotId,
            groupId: input.groupId,
            teacherId: input.teacherId,
            subjectId: input.subjectId,
            roomId: input.roomId ?? null,
            note: input.note ?? null,
          },
          include: {
            calendarDay: true,
            timeSlot: true,
            group: true,
            teacher: true,
            subject: true,
            room: true,
          },
        });

        return { kind: "ok" as const, row };
      });

      if (created.kind === "conflict") {
        const label =
          created.conflict === "TEACHER"
            ? "Teacher"
            : created.conflict === "GROUP"
              ? "Group"
              : "Room";
        return {
          ok: false as const,
          status: 409,
          message: `${label} already has a lesson at that time`,
        };
      }

      return {
        ok: true as const,
        data: {
          ...created.row,
          date: toISODateOnlyUTC(created.row.calendarDay.date),
          weekday: created.row.calendarDay.weekday,
          timeSlot: created.row.timeSlot
            ? {
                ...created.row.timeSlot,
                startTime: formatDbTime(created.row.timeSlot.startTime),
                endTime: formatDbTime(created.row.timeSlot.endTime),
              }
            : created.row.timeSlot,
        },
      };
    } catch (err: any) {
      if (isKnownRequestError(err) && err.code === "P2003") {
        return {
          ok: false as const,
          status: 400,
          message: formatForeignKeyMessage(err),
        };
      }

      throw err;
    }
  }

  async update(id: string, patch: UpdateMonthlyScheduleInput) {
    // Validate only the refs that are being changed.
    const refErrors = await validateScheduleRefs({
      timeSlotId: patch.timeSlotId,
      groupId: patch.groupId,
      teacherId: patch.teacherId,
      subjectId: patch.subjectId,
      roomId: patch.roomId,
    });
    if (refErrors.length) {
      return {
        ok: false as const,
        status: 400,
        message: refErrors.join(", "),
      };
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.schedule.findUnique({
          where: { id },
          select: {
            id: true,
            calendarDayId: true,
            timeSlotId: true,
            groupId: true,
            teacherId: true,
            subjectId: true,
            roomId: true,
            note: true,
          },
        });

        if (!existing) {
          return { kind: "not_found" as const };
        }

        let nextCalendarDayId = existing.calendarDayId;
        if (patch.date !== undefined) {
          const dateUtc = parseISODateOnlyToUTC(patch.date);
          if (!dateUtc) {
            return { kind: "bad_request" as const, message: "Invalid date" };
          }

          const month = dateUtc.getUTCMonth() + 1;
          const year = dateUtc.getUTCFullYear();
          const weekday = getWeekdayUTC(dateUtc);

          const calendarDay = await tx.calendarDay.upsert({
            where: { date: dateUtc },
            create: {
              date: dateUtc,
              weekday,
              month,
              year,
            },
            update: {
              weekday,
              month,
              year,
            },
          });
          nextCalendarDayId = calendarDay.id;
        }

        const finalTimeSlotId = patch.timeSlotId ?? existing.timeSlotId;
        const finalGroupId = patch.groupId ?? existing.groupId;
        const finalTeacherId = patch.teacherId ?? existing.teacherId;
        const finalSubjectId = patch.subjectId ?? existing.subjectId;
        const finalRoomId =
          patch.roomId !== undefined ? patch.roomId : existing.roomId;
        const finalNote = patch.note !== undefined ? patch.note : existing.note;

        const conflict = await detectScheduleConflict(
          tx,
          {
            calendarDayId: nextCalendarDayId,
            timeSlotId: finalTimeSlotId,
            groupId: finalGroupId,
            teacherId: finalTeacherId,
            subjectId: finalSubjectId,
            roomId: finalRoomId ?? null,
            note: finalNote ?? null,
          },
          { excludeId: id },
        );

        if (conflict) {
          return { kind: "conflict" as const, conflict };
        }

        const row = await tx.schedule.update({
          where: { id },
          data: {
            ...(nextCalendarDayId !== existing.calendarDayId
              ? { calendarDayId: nextCalendarDayId }
              : {}),
            ...(patch.timeSlotId !== undefined
              ? { timeSlotId: patch.timeSlotId }
              : {}),
            ...(patch.groupId !== undefined ? { groupId: patch.groupId } : {}),
            ...(patch.teacherId !== undefined
              ? { teacherId: patch.teacherId }
              : {}),
            ...(patch.subjectId !== undefined
              ? { subjectId: patch.subjectId }
              : {}),
            ...(patch.roomId !== undefined ? { roomId: patch.roomId } : {}),
            ...(patch.note !== undefined ? { note: patch.note } : {}),
          },
          include: {
            calendarDay: true,
            timeSlot: true,
            group: true,
            teacher: true,
            subject: true,
            room: true,
          },
        });

        return { kind: "ok" as const, row };
      });

      if (updated.kind === "not_found") {
        return {
          ok: false as const,
          status: 404,
          message: "Schedule not found",
        };
      }

      if (updated.kind === "bad_request") {
        return {
          ok: false as const,
          status: 400,
          message: updated.message,
        };
      }

      if (updated.kind === "conflict") {
        const label =
          updated.conflict === "TEACHER"
            ? "Teacher"
            : updated.conflict === "GROUP"
              ? "Group"
              : "Room";
        return {
          ok: false as const,
          status: 409,
          message: `${label} already has a lesson at that time`,
        };
      }

      return {
        ok: true as const,
        data: {
          ...updated.row,
          date: toISODateOnlyUTC(updated.row.calendarDay.date),
          weekday: updated.row.calendarDay.weekday,
          timeSlot: updated.row.timeSlot
            ? {
                ...updated.row.timeSlot,
                startTime: formatDbTime(updated.row.timeSlot.startTime),
                endTime: formatDbTime(updated.row.timeSlot.endTime),
              }
            : updated.row.timeSlot,
        },
      };
    } catch (err: any) {
      if (isKnownRequestError(err) && err.code === "P2025") {
        return {
          ok: false as const,
          status: 404,
          message: "Schedule not found",
        };
      }

      if (isKnownRequestError(err) && err.code === "P2003") {
        return {
          ok: false as const,
          status: 400,
          message: formatForeignKeyMessage(err),
        };
      }

      throw err;
    }
  }

  async remove(id: string) {
    try {
      await prisma.schedule.delete({ where: { id } });
      return { ok: true as const };
    } catch (err: any) {
      if (isKnownRequestError(err) && err.code === "P2025") {
        return {
          ok: false as const,
          status: 404,
          message: "Schedule not found",
        };
      }
      throw err;
    }
  }

  async bulkCreate(
    inputs: CreateMonthlyScheduleInput[],
    opts?: { mode?: BulkCreateMode },
  ) {
    const mode: BulkCreateMode = opts?.mode ?? "all_or_nothing";

    const list = Array.isArray(inputs) ? inputs : [];
    if (!list.length) {
      return {
        ok: false as const,
        status: 400,
        message: "No schedules to create",
      };
    }

    // Bulk validate refs for clearer errors and fewer DB roundtrips.
    const refErrors = await validateScheduleRefsBulk(list);
    if (refErrors.length) {
      return {
        ok: false as const,
        status: 400,
        message: Array.from(new Set(refErrors)).join(", "),
      };
    }

    // Basic date validation up-front.
    for (const [i, input] of list.entries()) {
      const dateUtc = parseISODateOnlyToUTC(input.date);
      if (!dateUtc) {
        return {
          ok: false as const,
          status: 400,
          message: `Invalid date at index ${i}`,
        };
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      let createdCount = 0;

      for (const input of list) {
        const dateUtc = parseISODateOnlyToUTC(input.date)!;
        const month = dateUtc.getUTCMonth() + 1;
        const year = dateUtc.getUTCFullYear();
        const weekday = getWeekdayUTC(dateUtc);

        const calendarDay = await tx.calendarDay.upsert({
          where: { date: dateUtc },
          create: { date: dateUtc, weekday, month, year },
          update: { weekday, month, year },
        });

        const conflict = await detectScheduleConflict(tx, {
          calendarDayId: calendarDay.id,
          timeSlotId: input.timeSlotId,
          groupId: input.groupId,
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          roomId: input.roomId ?? null,
          note: input.note ?? null,
        });

        if (conflict) {
          if (mode === "partial") {
            continue;
          }

          const label =
            conflict === "TEACHER"
              ? "Teacher"
              : conflict === "GROUP"
                ? "Group"
                : "Room";
          return {
            kind: "conflict" as const,
            status: 409,
            message: `${label} already has a lesson at that time`,
          };
        }

        await tx.schedule.create({
          data: {
            calendarDayId: calendarDay.id,
            timeSlotId: input.timeSlotId,
            groupId: input.groupId,
            teacherId: input.teacherId,
            subjectId: input.subjectId,
            roomId: input.roomId ?? null,
            note: input.note ?? null,
          },
        });

        createdCount += 1;
      }

      return { kind: "ok" as const, created: createdCount };
    });

    if (created.kind === "conflict") {
      return {
        ok: false as const,
        status: created.status,
        message: created.message,
      };
    }

    return {
      ok: true as const,
      data: { created: created.created },
    };
  }
}
