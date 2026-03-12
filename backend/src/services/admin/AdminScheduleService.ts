import type { Prisma, Weekday } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { formatDbTime } from "../../utils/time";

export type CreateScheduleEntryInput = {
  weekday: Weekday;
  groupId: string;
  teacherId: string;
  subjectId: string;
  timeSlotId: string;
  roomId?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};

export type UpdateScheduleEntryInput = {
  weekday?: Weekday;
  groupId?: string;
  teacherId?: string;
  subjectId?: string;
  timeSlotId?: string;
  roomId?: string | null;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};

export class AdminScheduleService {
  async list(params?: {
    groupId?: string;
    teacherId?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.ScheduleEntryWhereInput = {
      ...(params?.groupId ? { groupId: params.groupId } : {}),
      ...(params?.teacherId ? { teacherId: params.teacherId } : {}),
    };

    return prisma.scheduleEntry
      .findMany({
        where,
        include: {
          group: true,
          teacher: true,
          subject: true,
          timeSlot: true,
          room: true,
        },
        orderBy: [{ weekday: "asc" }, { timeSlot: { slotNumber: "asc" } }],
        take: params?.take ?? 100,
        skip: params?.skip ?? 0,
      })
      .then((rows) =>
        rows.map((r) => ({
          ...r,
          timeSlot: r.timeSlot
            ? {
                ...r.timeSlot,
                startTime: formatDbTime(r.timeSlot.startTime),
                endTime: formatDbTime(r.timeSlot.endTime),
              }
            : r.timeSlot,
        })),
      );
  }

  async getById(id: string) {
    return prisma.scheduleEntry
      .findUnique({
        where: { id },
        include: {
          group: true,
          teacher: true,
          subject: true,
          timeSlot: true,
          room: true,
        },
      })
      .then((r) =>
        r
          ? {
              ...r,
              timeSlot: r.timeSlot
                ? {
                    ...r.timeSlot,
                    startTime: formatDbTime(r.timeSlot.startTime),
                    endTime: formatDbTime(r.timeSlot.endTime),
                  }
                : r.timeSlot,
            }
          : r,
      );
  }

  async create(input: CreateScheduleEntryInput) {
    return prisma.scheduleEntry
      .create({
        data: {
          weekday: input.weekday,
          groupId: input.groupId,
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          timeSlotId: input.timeSlotId,
          roomId: input.roomId ?? null,
          effectiveFrom: input.effectiveFrom ?? null,
          effectiveTo: input.effectiveTo ?? null,
        },
        include: {
          group: true,
          teacher: true,
          subject: true,
          timeSlot: true,
          room: true,
        },
      })
      .then((r) => ({
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

  async update(id: string, input: UpdateScheduleEntryInput) {
    return prisma.scheduleEntry
      .update({
        where: { id },
        data: {
          ...(input.weekday !== undefined ? { weekday: input.weekday } : {}),
          ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
          ...(input.teacherId !== undefined
            ? { teacherId: input.teacherId }
            : {}),
          ...(input.subjectId !== undefined
            ? { subjectId: input.subjectId }
            : {}),
          ...(input.timeSlotId !== undefined
            ? { timeSlotId: input.timeSlotId }
            : {}),
          ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
          ...(input.effectiveFrom !== undefined
            ? { effectiveFrom: input.effectiveFrom }
            : {}),
          ...(input.effectiveTo !== undefined
            ? { effectiveTo: input.effectiveTo }
            : {}),
        },
        include: {
          group: true,
          teacher: true,
          subject: true,
          timeSlot: true,
          room: true,
        },
      })
      .then((r) => ({
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

  async remove(id: string) {
    await prisma.scheduleEntry.delete({ where: { id } });
    return true;
  }
}
