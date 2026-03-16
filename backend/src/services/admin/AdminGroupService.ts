import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateGroupInput = {
  name: string;
  cohortId?: string | null;
  parentGroupId?: string | null;
};

export type UpdateGroupInput = {
  name?: string;
  cohortId?: string | null;
  parentGroupId?: string | null;
};

export class AdminGroupService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.GroupWhereInput = params?.q
      ? { name: { contains: params.q } }
      : {};

    return prisma.group.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        parentGroup: { select: { id: true, name: true } },
        cohort: { select: { id: true, code: true, sortOrder: true } },
        _count: { select: { students: true } },
      },
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        parentGroup: { select: { id: true, name: true } },
        cohort: { select: { id: true, code: true, sortOrder: true } },
        students: { take: 5 },
        _count: { select: { students: true } },
      },
    });
  }

  async create(input: CreateGroupInput) {
    return prisma.group.create({
      data: {
        name: input.name,
        cohortId: input.cohortId ?? null,
        parentGroupId: input.parentGroupId ?? null,
      },
    });
  }

  async update(id: string, input: UpdateGroupInput) {
    return prisma.group.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.cohortId !== undefined ? { cohortId: input.cohortId } : {}),
        ...(input.parentGroupId !== undefined
          ? { parentGroupId: input.parentGroupId }
          : {}),
      },
    });
  }

  async remove(id: string) {
    await prisma.group.delete({ where: { id } });
    return true;
  }
}
