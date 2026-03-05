import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateGroupInput = {
  name: string;
};

export type UpdateGroupInput = {
  name?: string;
};

export class AdminGroupService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.GroupWhereInput = params?.q
      ? { name: { contains: params.q, mode: "insensitive" } }
      : {};

    return prisma.group.findMany({
      where,
      orderBy: { name: "asc" },
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.group.findUnique({
      where: { id },
      include: {
        students: { take: 5 },
        _count: { select: { students: true } },
      },
    });
  }

  async create(input: CreateGroupInput) {
    return prisma.group.create({ data: { name: input.name } });
  }

  async update(id: string, input: UpdateGroupInput) {
    return prisma.group.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
    });
  }

  async remove(id: string) {
    await prisma.group.delete({ where: { id } });
    return true;
  }
}
