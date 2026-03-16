import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateCohortInput = {
  code: string;
  sortOrder?: number | null;
  year?: number | null;
};

export type UpdateCohortInput = {
  code?: string;
  sortOrder?: number | null;
  year?: number | null;
};

export class AdminCohortService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.CohortWhereInput = params?.q
      ? { code: { contains: params.q } }
      : {};

    return prisma.cohort.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        _count: { select: { groups: true } },
      },
      take: params?.take ?? 200,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.cohort.findUnique({
      where: { id },
      include: {
        groups: {
          select: {
            id: true,
            name: true,
            parentGroup: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { groups: true } },
      },
    });
  }

  async create(input: CreateCohortInput) {
    return prisma.cohort.create({
      data: {
        code: input.code,
        sortOrder:
          input.sortOrder === null || input.sortOrder === undefined
            ? 0
            : Math.max(0, Math.floor(Number(input.sortOrder))),
        year:
          input.year === null || input.year === undefined
            ? null
            : Math.floor(Number(input.year)),
      },
    });
  }

  async update(id: string, input: UpdateCohortInput) {
    return prisma.cohort.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.sortOrder !== undefined
          ? {
              sortOrder:
                input.sortOrder === null
                  ? 0
                  : Math.max(0, Math.floor(Number(input.sortOrder))),
            }
          : {}),
        ...(input.year !== undefined
          ? {
              year: input.year === null ? null : Math.floor(Number(input.year)),
            }
          : {}),
      },
    });
  }

  async remove(id: string) {
    const count = await prisma.group.count({ where: { cohortId: id } });
    if (count > 0) {
      throw new Error("COHORT_HAS_GROUPS");
    }
    await prisma.cohort.delete({ where: { id } });
    return true;
  }
}
