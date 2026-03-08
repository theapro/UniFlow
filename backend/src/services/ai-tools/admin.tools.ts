import { prisma } from "../../config/prisma";

export async function getSystemStats() {
  const [
    totalStudents,
    totalTeachers,
    totalGroups,
    totalLessons,
    totalAttendance,
    totalGradeBooks,
    totalGradeRecords,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.group.count(),
    prisma.lesson.count(),
    prisma.attendance.count(),
    prisma.gradeBook.count(),
    prisma.gradeRecord.count(),
  ]);

  return {
    totals: {
      students: totalStudents,
      teachers: totalTeachers,
      groups: totalGroups,
      lessons: totalLessons,
      attendanceRecords: totalAttendance,
      gradeBooks: totalGradeBooks,
      gradeRecords: totalGradeRecords,
    },
  };
}

export async function getTopStudents(limit: number) {
  const take = Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), 50)
    : 10;

  // Aggregate by studentId.
  const grouped = await prisma.gradeRecord.groupBy({
    by: ["studentId"],
    _avg: { score: true },
    where: { score: { not: null } },
    orderBy: { _avg: { score: "desc" } },
    take,
  });

  const ids = grouped.map((g) => g.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      group: { select: { id: true, name: true } },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  return {
    limit: take,
    items: grouped
      .map((g) => {
        const s = byId.get(g.studentId);
        return {
          student: s ?? {
            id: g.studentId,
            fullName: null,
            studentNumber: null,
            group: null,
          },
          averageScore:
            g._avg.score !== null && g._avg.score !== undefined
              ? Math.round(Number(g._avg.score) * 100) / 100
              : null,
        };
      })
      .filter(Boolean),
  };
}

export async function getFailingStudents() {
  // Default threshold. Make configurable via AiSettings later if needed.
  const threshold = 60;

  const grouped = await prisma.gradeRecord.groupBy({
    by: ["studentId"],
    _avg: { score: true },
    where: { score: { not: null } },
    orderBy: { _avg: { score: "asc" } },
    take: 50,
  });

  const failing = grouped.filter(
    (g) => typeof g._avg.score === "number" && g._avg.score < threshold,
  );

  const ids = failing.map((g) => g.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      group: { select: { id: true, name: true } },
    },
  });
  const byId = new Map(students.map((s) => [s.id, s]));

  return {
    threshold,
    items: failing.map((g) => ({
      student: byId.get(g.studentId) ?? {
        id: g.studentId,
        fullName: null,
        studentNumber: null,
        group: null,
      },
      averageScore:
        g._avg.score !== null && g._avg.score !== undefined
          ? Math.round(Number(g._avg.score) * 100) / 100
          : null,
    })),
  };
}
