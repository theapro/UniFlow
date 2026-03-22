import type { PrismaClient } from "@prisma/client";

function uniqStrings(items: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const s = String(it ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export async function syncGroupSubjectDerivedLinks(
  prisma: PrismaClient,
  params: {
    groupId: string;
    subjectId: string;
    teacherIdsHint?: string[];
  },
): Promise<{ teacherIds: string[]; studentsUpdated: number }> {
  const teacherIds = uniqStrings(params.teacherIdsHint ?? []);

  const discoveredTeacherIds = teacherIds.length
    ? teacherIds
    : uniqStrings([
        ...(
          await prisma.schedule.findMany({
            where: { groupId: params.groupId, subjectId: params.subjectId },
            select: { teacherId: true },
            distinct: ["teacherId"],
            take: 50,
          })
        ).map((r) => r.teacherId),
        ...(
          await prisma.scheduleEntry.findMany({
            where: { groupId: params.groupId, subjectId: params.subjectId },
            select: { teacherId: true },
            distinct: ["teacherId"],
          })
        ).map((r) => r.teacherId),
        ...(
          await prisma.lesson.findMany({
            where: { groupId: params.groupId, subjectId: params.subjectId },
            select: { teacherId: true },
            distinct: ["teacherId"],
            take: 20,
          })
        ).map((r) => r.teacherId),
      ]);

  if (discoveredTeacherIds.length > 0) {
    await prisma.subject.update({
      where: { id: params.subjectId },
      data: {
        teachers: {
          connect: discoveredTeacherIds.map((id) => ({ id })),
        },
      },
      select: { id: true },
    });
  }

  return { teacherIds: discoveredTeacherIds, studentsUpdated: 0 };
}
