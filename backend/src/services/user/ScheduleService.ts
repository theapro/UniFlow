import { prisma } from "../../config/prisma";
import { getWeekdayUTC } from "../../utils/weekday";
import { formatDbTime } from "../../utils/time";

export class ScheduleService {
  async getScheduleByGroupId(groupId: string, weekday?: string) {
    const targetWeekday = weekday ? (weekday as any) : getWeekdayUTC();

    const rows = await prisma.scheduleEntry.findMany({
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

  async getScheduleByTeacherId(teacherId: string, weekday?: string) {
    const targetWeekday = weekday ? (weekday as any) : getWeekdayUTC();

    const rows = await prisma.scheduleEntry.findMany({
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
}
