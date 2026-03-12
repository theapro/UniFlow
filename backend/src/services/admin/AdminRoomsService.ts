import { prisma } from "../../config/prisma";

export class AdminRoomsService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const q = String(params?.q ?? "").trim();

    return prisma.room.findMany({
      where: q
        ? {
            name: {
              contains: q,
            },
          }
        : {},
      orderBy: { name: "asc" },
      take: params?.take ?? 500,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.room.findUnique({ where: { id } });
  }

  async create(input: { name: string; capacity?: number | null }) {
    return prisma.room.create({
      data: {
        name: input.name,
        capacity: input.capacity ?? null,
      },
    });
  }

  async update(id: string, patch: { name?: string; capacity?: number | null }) {
    return prisma.room.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
      },
    });
  }

  async remove(id: string) {
    return prisma.room.delete({ where: { id } });
  }
}
