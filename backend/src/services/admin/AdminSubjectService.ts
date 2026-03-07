import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateSubjectInput = {
  name: string;
  code?: string | null;
};

export type UpdateSubjectInput = {
  name?: string;
  code?: string | null;
};

export class AdminSubjectService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.SubjectWhereInput = params?.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" } },
            { code: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {};

    return prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
      include: {
        _count: {
          select: {
            teachers: true,
            lessons: true,
          },
        },
      },
    });
  }

  async getById(id: string) {
    return prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            teachers: true,
            lessons: true,
          },
        },
      },
    });
  }

  async create(input: CreateSubjectInput) {
    return prisma.subject.create({
      data: {
        name: input.name,
        code: input.code ?? null,
      },
    });
  }

  async update(id: string, input: UpdateSubjectInput) {
    return prisma.subject.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.code !== undefined ? { code: input.code } : {}),
      },
    });
  }

  async remove(id: string) {
    await prisma.$transaction(async (tx) => {
      // Remove attendance records for lessons of this subject
      await tx.attendance.deleteMany({
        where: {
          lesson: {
            subjectId: id,
          },
        },
      });

      // Remove lessons tied to this subject
      await tx.lesson.deleteMany({
        where: {
          subjectId: id,
        },
      });

      // Remove schedule entries tied to this subject
      await tx.scheduleEntry.deleteMany({
        where: {
          subjectId: id,
        },
      });

      // Unlink from teachers (many-to-many)
      await tx.subject.update({
        where: { id },
        data: {
          teachers: { set: [] },
        },
        select: { id: true },
      });

      await tx.subject.delete({ where: { id } });
    });

    return true;
  }
}
