import { prisma } from "../../config/prisma";
import { StudentFullContextService } from "../ai/StudentFullContextService";

const fullContextService = new StudentFullContextService();

export async function getStudentFullContext(studentId: string) {
  return fullContextService.getStudentFullContext(studentId);
}

export async function getStudentGroupSubjects(studentId: string) {
  const ctx = await fullContextService.getStudentFullContext(studentId);
  if (!ctx) return null;
  return {
    student: ctx.student,
    group: ctx.group,
    items: ctx.groupSubjects,
  };
}

export async function getStudentProfile(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      studentNumber: true,
      status: true,
      createdAt: true,
      group: { select: { id: true, name: true, cohortId: true } },
    },
  });

  if (!student) return null;

  return {
    id: student.id,
    fullName: student.fullName,
    studentNumber: student.studentNumber,
    email: student.email,
    phone: student.phone,
    status: student.status,
    group: student.group,
    createdAt: student.createdAt,
  };
}

export async function getStudentGroup(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      group: {
        select: {
          id: true,
          name: true,
          cohort: { select: { id: true, year: true } },
        },
      },
    },
  });

  if (!student) return null;

  return {
    student: { id: student.id, fullName: student.fullName },
    group: student.group,
  };
}

export async function getStudentAttendance(studentId: string) {
  const rows = await prisma.attendance.findMany({
    where: { studentId },
    select: {
      status: true,
      notedAt: true,
      lesson: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { notedAt: "desc" },
    take: 200,
  });

  const total = rows.length;
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const late = rows.filter((r) => r.status === "LATE").length;
  const excused = rows.filter((r) => r.status === "EXCUSED").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;

  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

  return {
    summary: {
      total,
      present,
      late,
      excused,
      absent,
      attendanceRatePercent: attendanceRate,
    },
    recent: rows.slice(0, 30),
  };
}

export async function getStudentSchedule(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, groupId: true, group: { select: { name: true } } },
  });

  if (!student?.groupId) {
    return { group: student?.group ?? null, week: [] as any[] };
  }

  const entries = await prisma.scheduleEntry.findMany({
    where: { groupId: student.groupId },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      timeSlot: {
        select: { id: true, order: true, startTime: true, endTime: true },
      },
      room: { select: { id: true, name: true } },
    },
    orderBy: [{ weekday: "asc" }, { timeSlot: { order: "asc" } }],
  });

  const week = entries.map((e) => ({
    weekday: e.weekday,
    subject: e.subject,
    teacher: e.teacher,
    room: e.room,
    timeSlot: e.timeSlot,
    effectiveFrom: e.effectiveFrom,
    effectiveTo: e.effectiveTo,
  }));

  return {
    group: student.group,
    week,
  };
}

export async function getStudentGrades(studentId: string) {
  const gradeBooks = await prisma.gradeBook.findMany({
    where: {
      records: { some: { studentId } },
    },
    select: {
      id: true,
      assignmentCount: true,
      group: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      records: {
        where: { studentId },
        select: {
          assignmentIndex: true,
          rawValue: true,
          score: true,
          updatedAt: true,
        },
        orderBy: { assignmentIndex: "asc" },
      },
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const items = gradeBooks.map((b) => {
    const scored = b.records
      .map((r) => r.score)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const avg =
      scored.length > 0
        ? scored.reduce((a, c) => a + c, 0) / scored.length
        : null;

    return {
      group: b.group,
      subject: b.subject,
      assignmentCount: b.assignmentCount,
      averageScore: avg !== null ? Math.round(avg * 100) / 100 : null,
      grades: b.records,
      updatedAt: b.updatedAt,
    };
  });

  return { items };
}
