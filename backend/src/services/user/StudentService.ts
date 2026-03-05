import { prisma } from "../../config/prisma";
import { getUTCDayRange, getWeekdayUTC } from "../../utils/weekday";

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

    return prisma.scheduleEntry.findMany({
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
      orderBy: [{ timeSlot: { order: "asc" } }],
    });
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
