import { prisma } from "../../config/prisma";
import { getWeekdayUTC } from "../../utils/weekday";

export class ScheduleService {
  async getScheduleByGroupId(groupId: string, weekday?: string) {
    const targetWeekday = weekday ? (weekday as any) : getWeekdayUTC();

    return prisma.scheduleEntry.findMany({
      where: {
        groupId,
        weekday: targetWeekday,
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

  async getScheduleByTeacherId(teacherId: string, weekday?: string) {
    const targetWeekday = weekday ? (weekday as any) : getWeekdayUTC();

    return prisma.scheduleEntry.findMany({
      where: {
        teacherId,
        weekday: targetWeekday,
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
        group: true,
        timeSlot: true,
        room: true,
      },
      orderBy: [{ timeSlot: { order: "asc" } }],
    });
  }
}
