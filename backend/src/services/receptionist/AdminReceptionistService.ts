import { ReceptionistLanguage, ReceptionistPersonality } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { normalizeText } from "./receptionistText";

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export class AdminReceptionistService {
  // --- Knowledge Base ---
  async listKnowledgeBase(params?: {
    q?: string;
    category?: string;
    language?: ReceptionistLanguage;
    take?: number;
    skip?: number;
  }) {
    const q = normalizeText(params?.q ?? "");
    const take = clampInt(params?.take ?? 200, 0, 500);
    const skip = clampInt(params?.skip ?? 0, 0, 1_000_000);

    return prisma.receptionistKnowledgeBaseEntry.findMany({
      where: {
        ...(params?.language ? { language: params.language } : {}),
        ...(params?.category
          ? { category: { equals: String(params.category).trim() } }
          : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
    });
  }

  async createKnowledgeBase(input: {
    title: string;
    content: string;
    category: string;
    language: ReceptionistLanguage;
    tags?: any;
    priority?: number;
  }) {
    return prisma.receptionistKnowledgeBaseEntry.create({
      data: {
        title: normalizeText(input.title).slice(0, 255),
        content: String(input.content ?? "").trim(),
        category: normalizeText(input.category).slice(0, 64),
        language: input.language,
        tags: input.tags ?? null,
        priority: clampInt(Number(input.priority ?? 0), -1000, 1000),
      },
    });
  }

  async updateKnowledgeBase(
    id: string,
    patch: Partial<{
      title: string;
      content: string;
      category: string;
      language: ReceptionistLanguage;
      tags: any;
      priority: number;
    }>,
  ) {
    return prisma.receptionistKnowledgeBaseEntry.update({
      where: { id },
      data: {
        ...(patch.title !== undefined
          ? { title: normalizeText(patch.title).slice(0, 255) }
          : {}),
        ...(patch.content !== undefined
          ? { content: String(patch.content ?? "").trim() }
          : {}),
        ...(patch.category !== undefined
          ? { category: normalizeText(patch.category).slice(0, 64) }
          : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags ?? null } : {}),
        ...(patch.priority !== undefined
          ? { priority: clampInt(Number(patch.priority), -1000, 1000) }
          : {}),
      },
    });
  }

  async deleteKnowledgeBase(id: string) {
    await prisma.receptionistKnowledgeBaseEntry.delete({ where: { id } });
    return true;
  }

  // --- Locations ---
  async listLocations(params?: { q?: string; take?: number; skip?: number }) {
    const q = normalizeText(params?.q ?? "");
    const take = clampInt(params?.take ?? 300, 0, 800);
    const skip = clampInt(params?.skip ?? 0, 0, 1_000_000);

    return prisma.receptionistLocation.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { building: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {},
      orderBy: [{ name: "asc" }],
      take,
      skip,
    });
  }

  async createLocation(input: {
    name: string;
    building?: string | null;
    floor?: string | null;
    description?: string | null;
  }) {
    return prisma.receptionistLocation.create({
      data: {
        name: normalizeText(input.name).slice(0, 140),
        building: normalizeText(input.building ?? "").slice(0, 140) || null,
        floor: normalizeText(input.floor ?? "").slice(0, 40) || null,
        description:
          typeof input.description === "string" && input.description.trim()
            ? input.description.trim()
            : null,
      },
    });
  }

  async updateLocation(
    id: string,
    patch: Partial<{
      name: string;
      building: string | null;
      floor: string | null;
      description: string | null;
    }>,
  ) {
    return prisma.receptionistLocation.update({
      where: { id },
      data: {
        ...(patch.name !== undefined
          ? { name: normalizeText(patch.name).slice(0, 140) }
          : {}),
        ...(patch.building !== undefined
          ? {
              building:
                normalizeText(patch.building ?? "").slice(0, 140) || null,
            }
          : {}),
        ...(patch.floor !== undefined
          ? { floor: normalizeText(patch.floor ?? "").slice(0, 40) || null }
          : {}),
        ...(patch.description !== undefined
          ? {
              description:
                typeof patch.description === "string" &&
                patch.description.trim()
                  ? patch.description.trim()
                  : null,
            }
          : {}),
      },
    });
  }

  async deleteLocation(id: string) {
    await prisma.receptionistLocation.delete({ where: { id } });
    return true;
  }

  // --- Directions ---
  async listDirections(params?: {
    fromLocationId?: string;
    toLocationId?: string;
    take?: number;
    skip?: number;
  }) {
    const take = clampInt(params?.take ?? 300, 0, 800);
    const skip = clampInt(params?.skip ?? 0, 0, 1_000_000);

    return prisma.receptionistDirection.findMany({
      where: {
        ...(params?.fromLocationId
          ? { fromLocationId: params.fromLocationId }
          : {}),
        ...(params?.toLocationId ? { toLocationId: params.toLocationId } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
      skip,
      include: {
        fromLocation: true,
        toLocation: true,
      },
    });
  }

  async createDirection(input: {
    fromLocationId: string;
    toLocationId: string;
    instructions: string;
  }) {
    return prisma.receptionistDirection.create({
      data: {
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        instructions: String(input.instructions ?? "").trim(),
      },
      include: { fromLocation: true, toLocation: true },
    });
  }

  async updateDirection(
    id: string,
    patch: Partial<{
      fromLocationId: string;
      toLocationId: string;
      instructions: string;
    }>,
  ) {
    return prisma.receptionistDirection.update({
      where: { id },
      data: {
        ...(patch.fromLocationId !== undefined
          ? { fromLocationId: patch.fromLocationId }
          : {}),
        ...(patch.toLocationId !== undefined
          ? { toLocationId: patch.toLocationId }
          : {}),
        ...(patch.instructions !== undefined
          ? { instructions: String(patch.instructions ?? "").trim() }
          : {}),
      },
      include: { fromLocation: true, toLocation: true },
    });
  }

  async deleteDirection(id: string) {
    await prisma.receptionistDirection.delete({ where: { id } });
    return true;
  }

  // --- Avatar settings ---
  async getAvatar() {
    return prisma.receptionistAiAvatar.upsert({
      where: { key: "default" },
      update: {},
      create: {
        key: "default",
        name: "LEIA",
        language: "UZ",
        personality: "FRIENDLY",
      },
    });
  }

  async updateAvatar(
    patch: Partial<{
      name: string;
      modelUrl: string | null;
      voice: string | null;
      language: ReceptionistLanguage;
      personality: ReceptionistPersonality;
    }>,
  ) {
    await this.getAvatar();

    return prisma.receptionistAiAvatar.update({
      where: { key: "default" },
      data: {
        ...(patch.name !== undefined
          ? { name: normalizeText(patch.name).slice(0, 80) }
          : {}),
        ...(patch.modelUrl !== undefined
          ? {
              modelUrl:
                typeof patch.modelUrl === "string" && patch.modelUrl.trim()
                  ? patch.modelUrl.trim().slice(0, 512)
                  : null,
            }
          : {}),
        ...(patch.voice !== undefined
          ? {
              voice:
                typeof patch.voice === "string" && patch.voice.trim()
                  ? patch.voice.trim().slice(0, 128)
                  : null,
            }
          : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.personality !== undefined
          ? { personality: patch.personality }
          : {}),
      },
    });
  }

  // --- Announcements ---
  async listAnnouncements(params?: {
    q?: string;
    take?: number;
    skip?: number;
    activeOnly?: boolean;
  }) {
    const q = normalizeText(params?.q ?? "");
    const take = clampInt(params?.take ?? 200, 0, 500);
    const skip = clampInt(params?.skip ?? 0, 0, 1_000_000);

    return prisma.receptionistAnnouncement.findMany({
      where: {
        ...(params?.activeOnly ? { isActive: true } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { content: { contains: q } },
                { targetAudience: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take,
      skip,
    });
  }

  async createAnnouncement(input: {
    title: string;
    content: string;
    targetAudience: string;
    language?: ReceptionistLanguage | null;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  }) {
    return prisma.receptionistAnnouncement.create({
      data: {
        title: normalizeText(input.title).slice(0, 200),
        content: String(input.content ?? "").trim(),
        targetAudience: normalizeText(input.targetAudience).slice(0, 80),
        language: input.language ?? null,
        isActive: input.isActive ?? true,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });
  }

  async updateAnnouncement(
    id: string,
    patch: Partial<{
      title: string;
      content: string;
      targetAudience: string;
      language: ReceptionistLanguage | null;
      isActive: boolean;
      startsAt: string | null;
      endsAt: string | null;
    }>,
  ) {
    return prisma.receptionistAnnouncement.update({
      where: { id },
      data: {
        ...(patch.title !== undefined
          ? { title: normalizeText(patch.title).slice(0, 200) }
          : {}),
        ...(patch.content !== undefined
          ? { content: String(patch.content ?? "").trim() }
          : {}),
        ...(patch.targetAudience !== undefined
          ? {
              targetAudience: normalizeText(patch.targetAudience).slice(0, 80),
            }
          : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.startsAt !== undefined
          ? { startsAt: patch.startsAt ? new Date(patch.startsAt) : null }
          : {}),
        ...(patch.endsAt !== undefined
          ? { endsAt: patch.endsAt ? new Date(patch.endsAt) : null }
          : {}),
      },
    });
  }

  async deleteAnnouncement(id: string) {
    await prisma.receptionistAnnouncement.delete({ where: { id } });
    return true;
  }
}
