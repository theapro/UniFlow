import { prisma } from "../../config/prisma";

export async function getGroupStudents(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  if (!group) return null;

  const students = await prisma.student.findMany({
    where: { groupId },
    select: { id: true, fullName: true, studentNumber: true, status: true },
    orderBy: { fullName: "asc" },
    take: 500,
  });

  return { group, students };
}

export async function getGroupAttendance(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  if (!group) return null;

  const rows = await prisma.attendance.findMany({
    where: { lesson: { groupId } },
    select: {
      status: true,
      notedAt: true,
      student: { select: { id: true, fullName: true, studentNumber: true } },
      lesson: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
        },
      },
    },
    orderBy: { notedAt: "desc" },
    take: 1000,
  });

  const total = rows.length;
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  return {
    group,
    summary: {
      total,
      present,
      attendanceRatePercent: rate,
    },
    recent: rows.slice(0, 50),
  };
}

export async function getGroupGrades(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true },
  });
  if (!group) return null;

  const books = await prisma.gradeBook.findMany({
    where: { groupId },
    select: {
      id: true,
      assignmentCount: true,
      subject: { select: { id: true, name: true } },
      updatedAt: true,
      records: {
        select: { studentId: true, score: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const items = books.map((b) => {
    const scores = b.records
      .map((r) => r.score)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const avg =
      scores.length > 0
        ? scores.reduce((a, c) => a + c, 0) / scores.length
        : null;

    return {
      subject: b.subject,
      assignmentCount: b.assignmentCount,
      averageScore: avg !== null ? Math.round(avg * 100) / 100 : null,
      updatedAt: b.updatedAt,
    };
  });

  return { group, items };
}
