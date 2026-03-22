import { prisma } from "../../config/prisma";

function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfLocalMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function startOfLocalWeekMonday(date: Date): Date {
  // JS: 0=Sun..6=Sat. ISO week: Monday start.
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

function getLocalDayRange(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return { start, end };
}

async function resolveActiveStudentGroupIdsByUserId(
  userId: string,
): Promise<string[]> {
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
    orderBy: [
      { calendarDay: { date: "asc" } },
      { timeSlot: { slotNumber: "asc" } },
    ],
  });
}

export async function getTodaySchedule(params: { userId: string }) {
  const { start, end } = getLocalDayRange();
  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive: end,
  });
}

export async function getWeeklySchedule(params: { userId: string }) {
  const now = new Date();
  const start = startOfLocalWeekMonday(now);
  const endExclusive = addLocalDays(start, 7);

  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive,
  });
}

export async function getMonthlySchedule(params: { userId: string }) {
  const now = new Date();
  const start = startOfLocalMonth(now);
  const nextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0,
    0,
  );

  return getScheduleByUserGroupsInRange({
    userId: params.userId,
    start,
    endExclusive: nextMonth,
  });
}
