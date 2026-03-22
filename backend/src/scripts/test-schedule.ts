import { prisma } from "../config/prisma";
import {
  getMonthlySchedule,
  getTodaySchedule,
  getWeeklySchedule,
} from "../ai/tools/scheduleTools";
import { getUTCDayRange } from "../utils/weekday";

function isoDateOnlyUTC(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

async function main() {
  const requestedUserId = process.env.TEST_USER_ID ?? null;

  const scheduleTotal = await prisma.schedule.count();
  const scheduleEntryTotal = await prisma.scheduleEntry.count();
  console.log("DB totals:");
  console.log("- Schedule:", scheduleTotal);
  console.log("- ScheduleEntry:", scheduleEntryTotal);

  const user = requestedUserId
    ? await prisma.user.findUnique({
        where: { id: requestedUserId },
        select: { id: true, email: true, role: true, studentId: true },
      })
    : await (async () => {
        // Prefer a student whose active group actually has Schedule rows.
        if (scheduleTotal > 0) {
          const scheduledGroup = await prisma.schedule.findFirst({
            orderBy: { createdAt: "desc" },
            select: { groupId: true },
          });

          if (scheduledGroup?.groupId) {
            const sg = await prisma.studentGroup.findFirst({
              where: {
                groupId: scheduledGroup.groupId,
                leftAt: null,
                student: { user: { isNot: null } },
              },
              select: {
                student: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        email: true,
                        role: true,
                        studentId: true,
                      },
                    },
                  },
                },
              },
            });

            const u = sg?.student?.user ?? null;
            if (u) return u;
          }
        }

        // Fallback: any student user (may have empty schedule).
        return prisma.user.findFirst({
          where: { studentId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, studentId: true },
        });
      })();

  if (!user) {
    throw new Error(
      "No user found. Set TEST_USER_ID to a valid user id (must be linked to a student).",
    );
  }

  console.log("Using user:", user);

  if (!user.studentId) {
    throw new Error(
      `User ${user.id} is not linked to a student (studentId is null).`,
    );
  }

  const student = await prisma.student.findUnique({
    where: { id: user.studentId },
    select: {
      id: true,
      fullName: true,
      studentGroups: {
        where: { leftAt: null },
        select: { groupId: true, group: { select: { name: true } } },
      },
    },
  });

  console.log("Resolved student:", {
    id: student?.id ?? null,
    fullName: student?.fullName ?? null,
    groups:
      student?.studentGroups.map((g) => ({
        id: g.groupId,
        name: g.group.name,
      })) ?? [],
  });

  const groupIds = student?.studentGroups.map((g) => g.groupId) ?? [];
  if (groupIds.length === 0) {
    console.log("No active groups; schedule will be empty.");
  }

  const totalForGroups =
    groupIds.length > 0
      ? await prisma.schedule.count({ where: { groupId: { in: groupIds } } })
      : 0;

  const { start: todayStart, end: todayEnd } = getUTCDayRange();
  const todayForGroups =
    groupIds.length > 0
      ? await prisma.schedule.count({
          where: {
            groupId: { in: groupIds },
            calendarDay: { date: { gte: todayStart, lt: todayEnd } },
          },
        })
      : 0;

  console.log("Diagnostics:");
  console.log("- groupIds:", groupIds);
  console.log("- schedule.count(groupIds):", totalForGroups);
  console.log(
    `- UTC today range: [${todayStart.toISOString()} .. ${todayEnd.toISOString()}) (${isoDateOnlyUTC(todayStart)})`,
  );
  console.log("- schedule.count(today, groupIds):", todayForGroups);

  const today = await getTodaySchedule({ userId: user.id });
  const weekly = await getWeeklySchedule({ userId: user.id });
  const monthly = await getMonthlySchedule({ userId: user.id });

  console.log("\nResults:");
  console.log("- getTodaySchedule:", today.length);
  console.log("- getWeeklySchedule:", weekly.length);
  console.log("- getMonthlySchedule:", monthly.length);

  const preview = (label: string, rows: any[]) => {
    console.log(`\n${label} (first 5):`);
    for (const r of rows.slice(0, 5)) {
      const date = r.calendarDay?.date
        ? isoDateOnlyUTC(new Date(r.calendarDay.date))
        : null;
      const slot = r.timeSlot?.slotNumber ?? null;
      const subject = r.subject?.name ?? null;
      const teacher = r.teacher?.fullName ?? null;
      const room = r.room?.name ?? null;
      console.log({ date, slot, subject, teacher, room });
    }
  };

  preview("Today", today);
  preview("Weekly", weekly);
  preview("Monthly", monthly);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
