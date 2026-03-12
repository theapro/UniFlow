import { prisma } from "../../config/prisma";
import { getUTCDayRange, getWeekdayUTC } from "../../utils/weekday";
import { formatDbTime } from "../../utils/time";

export class StudentService {
  async getTodaySchedule(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, groupId: true },
    });

    if (!student?.groupId) {
      return [];
    }

    const weekday = getWeekdayUTC();

    const rows = await prisma.scheduleEntry.findMany({
      where: {
        groupId: student.groupId,
        weekday,
        OR: [
          { effectiveFrom: null, effectiveTo: null },
          {
            AND: [
              {
                OR: [
                  { effectiveFrom: null },
                  { effectiveFrom: { lte: new Date() } },
                ],
              },
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: new Date() } },
                ],
              },
            ],
          },
        ],
      },
      include: {
        subject: true,
        teacher: true,
        timeSlot: true,
        room: true,
      },
      orderBy: [{ timeSlot: { slotNumber: "asc" } }],
    });

    return rows.map((r) => ({
      ...r,
      timeSlot: r.timeSlot
        ? {
            ...r.timeSlot,
            startTime: formatDbTime(r.timeSlot.startTime),
            endTime: formatDbTime(r.timeSlot.endTime),
          }
        : r.timeSlot,
    }));
  }

  async getAttendance(studentId: string) {
    return prisma.attendance.findMany({
      where: { studentId },
      include: {
        lesson: {
          include: {
            subject: true,
            teacher: true,
            group: true,
          },
        },
      },
      orderBy: { notedAt: "desc" },
    });
  }

  async getTodayLessonsFromLessonTable(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { groupId: true },
    });

    if (!student?.groupId) {
      return [];
    }

    const { start, end } = getUTCDayRange();

    return prisma.lesson.findMany({
      where: {
        groupId: student.groupId,
        startsAt: { gte: start, lt: end },
      },
      include: {
        subject: true,
        teacher: true,
        group: true,
      },
      orderBy: { startsAt: "asc" },
    });
  }
}
