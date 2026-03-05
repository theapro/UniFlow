import { prisma } from "../../config/prisma";
import { getUTCDayRange, getWeekdayUTC } from "../../utils/weekday";

export class TeacherService {
  async getTodayLessons(teacherId: string) {
    const { start, end } = getUTCDayRange();

    return prisma.lesson.findMany({
      where: {
        teacherId,
        startsAt: { gte: start, lt: end },
      },
      include: {
        subject: true,
        group: true,
      },
      orderBy: { startsAt: "asc" },
    });
  }

  async getGroupSchedule(teacherId: string, groupId: string) {
    const weekday = getWeekdayUTC();

    return prisma.scheduleEntry.findMany({
      where: {
        teacherId,
        groupId,
        weekday,
      },
      include: {
        subject: true,
        timeSlot: true,
        room: true,
      },
      orderBy: [{ timeSlot: { order: "asc" } }],
    });
  }
}
