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
  teacherId?: string;
  subjectId?: string;
  roomId?: string | null;
  note?: string | null;
};

export class AdminMonthlyScheduleService {
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
    const dateUtc = parseISODateOnlyToUTC(input.date);
    if (!dateUtc) {
      return { ok: false as const, status: 400, message: "Invalid date" };
    }

    const month = dateUtc.getUTCMonth() + 1;
    const year = dateUtc.getUTCFullYear();
    const weekday = getWeekdayUTC(dateUtc);

    const calendarDay = await prisma.calendarDay.upsert({
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

    try {
      const created = await prisma.schedule.create({
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

      return {
        ok: true as const,
        data: {
          ...created,
          date: toISODateOnlyUTC(created.calendarDay.date),
          weekday: created.calendarDay.weekday,
          timeSlot: created.timeSlot
            ? {
                ...created.timeSlot,
                startTime: formatDbTime(created.timeSlot.startTime),
                endTime: formatDbTime(created.timeSlot.endTime),
              }
            : created.timeSlot,
        },
      };
    } catch (err: any) {
      const conflict = classifyScheduleConflict(err);
      if (conflict) {
        const label =
          conflict === "TEACHER"
            ? "Teacher"
            : conflict === "GROUP"
              ? "Group"
              : "Room";
        return {
          ok: false as const,
          status: 409,
          message: `${label} already has a lesson at that time`,
        };
      }
      throw err;
    }
  }

  async update(id: string, patch: UpdateMonthlyScheduleInput) {
    try {
      const updated = await prisma.schedule.update({
        where: { id },
        data: {
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

      return {
        ok: true as const,
        data: {
          ...updated,
          date: toISODateOnlyUTC(updated.calendarDay.date),
          weekday: updated.calendarDay.weekday,
          timeSlot: updated.timeSlot
            ? {
                ...updated.timeSlot,
                startTime: formatDbTime(updated.timeSlot.startTime),
                endTime: formatDbTime(updated.timeSlot.endTime),
              }
            : updated.timeSlot,
        },
      };
    } catch (err: any) {
      const conflict = classifyScheduleConflict(err);
      if (conflict) {
        const label =
          conflict === "TEACHER"
            ? "Teacher"
            : conflict === "GROUP"
              ? "Group"
              : "Room";
        return {
          ok: false as const,
          status: 409,
          message: `${label} already has a lesson at that time`,
        };
      }
      throw err;
    }
  }

  async remove(id: string) {
    await prisma.schedule.delete({ where: { id } });
    return true;
  }
}
