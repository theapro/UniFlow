import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateLessonInput = {
  startsAt: Date;
  endsAt: Date;
  room?: string | null;
  groupId: string;
  teacherId: string;
  subjectId: string;
};

export type UpdateLessonInput = {
  startsAt?: Date;
  endsAt?: Date;
  room?: string | null;
  groupId?: string;
  teacherId?: string;
  subjectId?: string;
};

export class AdminLessonService {
  async list(params?: {
    groupId?: string;
    subjectId?: string;
    teacherId?: string;
    from?: Date;
    to?: Date;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.LessonWhereInput = {
      ...(params?.groupId ? { groupId: params.groupId } : {}),
      ...(params?.subjectId ? { subjectId: params.subjectId } : {}),
      ...(params?.teacherId ? { teacherId: params.teacherId } : {}),
      ...(params?.from || params?.to
        ? {
            startsAt: {
              ...(params?.from ? { gte: params.from } : {}),
              ...(params?.to ? { lt: params.to } : {}),
            },
          }
        : {}),
    };

    return prisma.lesson.findMany({
      where,
      include: {
        group: true,
        teacher: true,
        subject: true,
        _count: { select: { attendance: true } },
      },
      orderBy: { startsAt: "desc" },
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.lesson.findUnique({
      where: { id },
      include: {
        group: true,
        teacher: true,
        subject: true,
        attendance: { include: { student: true } },
      },
    });
  }

  async create(input: CreateLessonInput) {
    return prisma.lesson.create({
      data: {
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        room: input.room ?? null,
        groupId: input.groupId,
        teacherId: input.teacherId,
        subjectId: input.subjectId,
      },
      include: {
        group: true,
        teacher: true,
        subject: true,
      },
    });
  }

  async update(id: string, input: UpdateLessonInput) {
    return prisma.lesson.update({
      where: { id },
      data: {
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.room !== undefined ? { room: input.room } : {}),
        ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
        ...(input.teacherId !== undefined
          ? { teacherId: input.teacherId }
          : {}),
        ...(input.subjectId !== undefined
          ? { subjectId: input.subjectId }
          : {}),
      },
      include: {
        group: true,
        teacher: true,
        subject: true,
      },
    });
  }

  async remove(id: string) {
    await prisma.lesson.delete({ where: { id } });
    return true;
  }
}
