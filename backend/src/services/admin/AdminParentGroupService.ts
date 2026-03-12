import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateParentGroupInput = {
  name: string;
};

export type UpdateParentGroupInput = {
  name?: string;
};

export class AdminParentGroupService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.ParentGroupWhereInput = params?.q
      ? { name: { contains: params.q } }
      : {};

    return prisma.parentGroup.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { groups: true } },
      },
      take: params?.take ?? 200,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.parentGroup.findUnique({
      where: { id },
      include: {
        groups: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        _count: { select: { groups: true } },
      },
    });
  }

  async create(input: CreateParentGroupInput) {
    return prisma.parentGroup.create({
      data: {
        name: input.name,
      },
    });
  }

  async update(id: string, input: UpdateParentGroupInput) {
    return prisma.parentGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
      },
    });
  }

  async remove(id: string) {
    // Groups are kept; they just detach (onDelete: SetNull).
    await prisma.parentGroup.delete({ where: { id } });
    return true;
  }
}
