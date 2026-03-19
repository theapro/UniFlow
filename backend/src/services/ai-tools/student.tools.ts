import { prisma } from "../../config/prisma";
import { StudentFullContextService } from "../ai/StudentFullContextService";
import { formatDbTime, formatTimeRange } from "../../utils/time";

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
        select: { id: true, slotNumber: true, startTime: true, endTime: true },
      },
      room: { select: { id: true, name: true } },
    },
    orderBy: [{ weekday: "asc" }, { timeSlot: { slotNumber: "asc" } }],
  });

  const week = entries.map((e) => ({
    weekday: e.weekday,
    subject: e.subject,
    teacher: e.teacher,
    room: e.room,
    timeSlot: e.timeSlot
      ? {
          id: e.timeSlot.id,
          slotNumber: e.timeSlot.slotNumber,
          startTime: formatDbTime(e.timeSlot.startTime),
          endTime: formatDbTime(e.timeSlot.endTime),
        }
      : null,
    effectiveFrom: e.effectiveFrom,
    effectiveTo: e.effectiveTo,
  }));

  return {
    group: student.group,
    week,
  };
}

export async function getStudentMonthlySchedule(params: {
  studentId: string;
  month?: number;
  year?: number;
}) {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: {
      id: true,
      groupId: true,
      group: { select: { id: true, name: true, cohortId: true } },
    },
  });

  const now = new Date();
  const year = Number.isFinite(params.year)
    ? Number(params.year)
    : now.getFullYear();
  const month = Number.isFinite(params.month)
    ? Math.min(12, Math.max(1, Number(params.month)))
    : now.getMonth() + 1;

  if (!student?.groupId) {
    return {
      group: student?.group ?? null,
      year,
      month,
      days: [] as any[],
    };
  }

  const rows = await prisma.schedule.findMany({
    where: {
      groupId: student.groupId,
      calendarDay: {
        year,
        month,
      },
    },
    include: {
      calendarDay: {
        select: { date: true, weekday: true, month: true, year: true },
      },
      timeSlot: {
        select: { id: true, slotNumber: true, startTime: true, endTime: true },
      },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      room: { select: { id: true, name: true } },
    },
    orderBy: [
      { calendarDay: { date: "asc" } },
      { timeSlot: { slotNumber: "asc" } },
    ],
    take: 2000,
  });

  const byDate = new Map<
    string,
    {
      date: string;
      weekday: string;
      items: Array<{
        timeSlot: {
          slotNumber: number;
          startTime: string | null;
          endTime: string | null;
          time: string | null;
        } | null;
        subject: { id: string; name: string } | null;
        teacher: { id: string; name: string } | null;
        room: { id: string; name: string } | null;
        note: string | null;
      }>;
    }
  >();

  for (const r of rows) {
    const isoDate = r.calendarDay.date.toISOString().slice(0, 10);
    const day = byDate.get(isoDate) ?? {
      date: isoDate,
      weekday: String(r.calendarDay.weekday),
      items: [],
    };

    day.items.push({
      timeSlot: r.timeSlot
        ? {
            slotNumber: r.timeSlot.slotNumber,
            startTime: formatDbTime(r.timeSlot.startTime),
            endTime: formatDbTime(r.timeSlot.endTime),
            time: formatTimeRange(r.timeSlot.startTime, r.timeSlot.endTime),
          }
        : null,
      subject: r.subject ? { id: r.subject.id, name: r.subject.name } : null,
      teacher: r.teacher
        ? { id: r.teacher.id, name: r.teacher.fullName }
        : null,
      room: r.room ? { id: r.room.id, name: r.room.name } : null,
      note: r.note ?? null,
    });

    byDate.set(isoDate, day);
  }

  return {
    group: student.group,
    year,
    month,
    days: Array.from(byDate.values()),
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
