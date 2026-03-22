import { prisma } from "../../config/prisma";
import { assertRole } from "./access";
import { Role } from "@prisma/client";

export async function getSystemStats(params: { user: Express.User }): Promise<{
  counts: {
    users: number;
    students: number;
    teachers: number;
    groups: number;
    lessons: number;
    scheduleEntries: number;
    attendance: number;
    gradeBooks: number;
    gradeRecords: number;
  };
}> {
  assertRole(params.user, [Role.ADMIN]);

  const [
    users,
    students,
    teachers,
    groups,
    lessons,
    scheduleEntries,
    attendance,
    gradeBooks,
    gradeRecords,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.group.count(),
    prisma.lesson.count(),
    prisma.scheduleEntry.count(),
    prisma.attendance.count(),
    prisma.gradeBook.count(),
    prisma.gradeRecord.count(),
  ]);

  return {
    counts: {
      users,
      students,
      teachers,
      groups,
      lessons,
      scheduleEntries,
      attendance,
      gradeBooks,
      gradeRecords,
    },
  };
}
