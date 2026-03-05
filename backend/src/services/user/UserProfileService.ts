import { prisma } from "../../config/prisma";

export type UserProfileUpdate = {
  interests?: unknown;
  preferences?: unknown;
  notes?: string | null;
};

export class UserProfileService {
  async getOrCreate(userId: string) {
    const existing = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        interests: true,
        preferences: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) return existing;

    return prisma.userProfile.create({
      data: { userId },
      select: {
        id: true,
        userId: true,
        interests: true,
        preferences: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(userId: string, patch: UserProfileUpdate) {
    await this.getOrCreate(userId);

    return prisma.userProfile.update({
      where: { userId },
      data: {
        interests: patch.interests as any,
        preferences: patch.preferences as any,
        notes: patch.notes,
      },
      select: {
        id: true,
        userId: true,
        interests: true,
        preferences: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Minimal heuristic extraction from the user's plain text.
  // This intentionally avoids heavy/expensive LLM calls.
  async inferFromMessage(userId: string, message: string) {
    const normalized = message.toLowerCase();

    const interestMatches: string[] = [];

    // English patterns
    const likeMatch = normalized.match(
      /\b(i\s+like|i\s+love|i\s+enjoy)\s+([^\.\n]{2,80})/,
    );
    if (likeMatch?.[2]) interestMatches.push(likeMatch[2].trim());

    const interestedMatch = normalized.match(
      /\b(i\s+am\s+interested\s+in)\s+([^\.\n]{2,80})/,
    );
    if (interestedMatch?.[2]) interestMatches.push(interestedMatch[2].trim());

    // Uzbek patterns
    const uz1 = normalized.match(/\bmen\s+([^\.\n]{2,80})\s+ga\s+qiziqaman/);
    if (uz1?.[1]) interestMatches.push(uz1[1].trim());

    const uz2 = normalized.match(/\bmen\s+([^\.\n]{2,80})\s+ni\s+yoqtiraman/);
    if (uz2?.[1]) interestMatches.push(uz2[1].trim());

    if (interestMatches.length === 0) return null;

    const profile = await this.getOrCreate(userId);
    const currentInterests = Array.isArray(profile.interests)
      ? (profile.interests as unknown[])
      : [];

    const merged = Array.from(
      new Set([
        ...currentInterests.map((x) => String(x).trim()).filter(Boolean),
        ...interestMatches,
      ]),
    ).slice(0, 50);

    return this.update(userId, {
      interests: merged,
      notes: profile.notes ?? null,
    });
  }
}
