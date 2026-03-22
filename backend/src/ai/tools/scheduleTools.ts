import { prisma } from "../../config/prisma";
import { getUTCDayRange } from "../../utils/weekday";

function addUtcDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
      0,
      0,
      0,
      0,
    ),
  );
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfUtcWeekMonday(date: Date): Date {
  // JS: 0=Sun..6=Sat. ISO week: Monday start.
  const day = date.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  return addUtcDays(date, -diffToMonday);
}

async function resolveActiveStudentGroupIdsByUserId(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, studentId: true },
  });

  if (!user?.studentId) {
    return [];
  }

  const student = await prisma.student.findUnique({
    where: { id: user.studentId },
    select: {
      id: true,
      studentGroups: {
        where: { leftAt: null },
        select: { groupId: true },
      },
    },
  });

  if (!student) {
    return [];
  }

  return student.studentGroups.map((g) => g.groupId);
}

function scheduleIncludes() {
  return {
    subject: { select: { id: true, name: true } },
    teacher: { select: { id: true, fullName: true } },
    room: { select: { id: true, name: true } },
    timeSlot: {
      select: { id: true, slotNumber: true, startTime: true, endTime: true },
    },
    calendarDay: {
      select: { id: true, date: true, weekday: true, month: true, year: true },
    },
  };
}

async function getScheduleByUserGroupsInRange(params: {
  userId: string;
  start: Date;
  endExclusive: Date;
}) {
  const groupIds = await resolveActiveStudentGroupIdsByUserId(params.userId);
  if (groupIds.length === 0) return [];

  return prisma.schedule.findMany({
    where: {
      groupId: { in: groupIds },
      calendarDay: {
        date: {
          gte: params.start,
          lt: params.endExclusive,
        },
      },
    },
    include: scheduleIncludes(),
    orderBy: [{ calendarDay: { date: "asc" } }, { timeSlot: { slotNumber: "asc" } }],
  });
}

export async function getTodaySchedule(params: { userId: string }) {
  const { start, end } = getUTCDayRange();
  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive: end,
  });
}

export async function getWeeklySchedule(params: { userId: string }) {
  const now = new Date();
  const start = startOfUtcWeekMonday(now);
  const endExclusive = addUtcDays(start, 7);

  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive,
  });
}

export async function getMonthlySchedule(params: { userId: string }) {
  const now = new Date();
  const start = startOfUtcMonth(now);
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive: nextMonth,
  });
}
