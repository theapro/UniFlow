import type { Prisma, Weekday } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { formatDbTime } from "../../utils/time";
import { syncGroupSubjectDerivedLinks } from "../sync/derivedRelations";

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
    const created = await prisma.scheduleEntry
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

    try {
      await syncGroupSubjectDerivedLinks(prisma, {
        groupId: created.groupId,
        subjectId: created.subjectId,
        teacherIdsHint: [created.teacherId],
      });
    } catch {
      // Non-fatal
    }

    return created;
  }

  async update(id: string, input: UpdateScheduleEntryInput) {
    const prev = await prisma.scheduleEntry.findUnique({
      where: { id },
      select: { groupId: true, subjectId: true },
    });

    const updated = await prisma.scheduleEntry
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

    try {
      const targets = new Set<string>([
        `${updated.groupId}:${updated.subjectId}`,
        prev?.groupId && prev?.subjectId
          ? `${prev.groupId}:${prev.subjectId}`
          : "",
      ]);
      for (const key of targets) {
        const [groupId, subjectId] = key.split(":");
        if (!groupId || !subjectId) continue;
        await syncGroupSubjectDerivedLinks(prisma, {
          groupId,
          subjectId,
          teacherIdsHint: [updated.teacherId],
        });
      }
    } catch {
      // Non-fatal
    }

    return updated;
  }

  async remove(id: string) {
    const prev = await prisma.scheduleEntry.findUnique({
      where: { id },
      select: { groupId: true, subjectId: true },
    });
    await prisma.scheduleEntry.delete({ where: { id } });

    if (prev?.groupId && prev?.subjectId) {
      try {
        await syncGroupSubjectDerivedLinks(prisma, {
          groupId: prev.groupId,
          subjectId: prev.subjectId,
        });
      } catch {
        // Non-fatal
      }
    }
    return true;
  }
}
