import type { Prisma, Weekday } from "@prisma/client";
import { prisma } from "../../config/prisma";

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

    return prisma.scheduleEntry.findMany({
      where,
      include: {
        group: true,
        teacher: true,
        subject: true,
        timeSlot: true,
        room: true,
      },
      orderBy: [{ weekday: "asc" }, { timeSlot: { order: "asc" } }],
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.scheduleEntry.findUnique({
      where: { id },
      include: {
        group: true,
        teacher: true,
        subject: true,
        timeSlot: true,
        room: true,
      },
    });
  }

  async create(input: CreateScheduleEntryInput) {
    return prisma.scheduleEntry.create({
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
    });
  }

  async update(id: string, input: UpdateScheduleEntryInput) {
    return prisma.scheduleEntry.update({
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
    });
  }

  async remove(id: string) {
    await prisma.scheduleEntry.delete({ where: { id } });
    return true;
  }
}
