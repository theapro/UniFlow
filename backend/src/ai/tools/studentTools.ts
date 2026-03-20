import { prisma } from "../../config/prisma";
import { formatDbTime } from "../../utils/time";
import { getWeekdayUTC } from "../../utils/weekday";
import { assertStudentSelf } from "./access";

export async function getStudentProfile(params: {
  user: Express.User;
}): Promise<{
  profile: {
    id: string;
    fullName: string;
    studentNumber: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    note: string | null;
    group: { id: string; name: string } | null;
  };
}> {
  const studentId = params.user.studentId;
  if (!studentId) throw new Error("Student profile not linked");
  assertStudentSelf(params.user, studentId);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      studentNumber: true,
      email: true,
      phone: true,
      status: true,
      note: true,
      studentGroups: {
        where: { leftAt: null },
        select: { group: { select: { id: true, name: true } } },
        orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!student) throw new Error("Student not found");

  return {
    profile: {
      id: student.id,
      fullName: student.fullName,
      studentNumber: student.studentNumber ?? null,
      email: student.email ?? null,
      phone: student.phone ?? null,
      status: String(student.status),
      note: student.note ?? null,
      group: student.studentGroups[0]?.group ?? null,
    },
  };
}

export async function getStudentScheduleToday(params: {
  user: Express.User;
}): Promise<{
  scheduleToday: Array<{
    subject: string | null;
    teacher: string | null;
    room: string | null;
    startTime: string | null;
    endTime: string | null;
  }>;
}> {
  const studentId = params.user.studentId;
  if (!studentId) throw new Error("Student profile not linked");
  assertStudentSelf(params.user, studentId);

  const membership = await prisma.studentGroup.findFirst({
    where: { studentId, leftAt: null },
    select: { groupId: true },
    orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
  });

  const weekday = getWeekdayUTC();

  const scheduleRows = membership?.groupId
    ? await prisma.scheduleEntry.findMany({
        where: {
          groupId: membership.groupId,
          weekday,
          OR: [
            { effectiveFrom: null, effectiveTo: null },
            {
              AND: [
                {
                  OR: [
                    { effectiveFrom: null },
                    { effectiveFrom: { lte: new Date() } },
                  ],
                },
                {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: new Date() } },
                  ],
                },
              ],
            },
          ],
        },
        orderBy: [{ timeSlot: { slotNumber: "asc" } }],
        select: {
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          room: { select: { name: true } },
          timeSlot: { select: { startTime: true, endTime: true } },
        },
      })
    : [];

  return {
    scheduleToday: scheduleRows.slice(0, 12).map((r) => ({
      subject: r.subject?.name ?? null,
      teacher: r.teacher?.fullName ?? null,
      room: r.room?.name ?? null,
      startTime: r.timeSlot ? formatDbTime(r.timeSlot.startTime) : null,
      endTime: r.timeSlot ? formatDbTime(r.timeSlot.endTime) : null,
    })),
  };
}

export async function getStudentAttendanceRecent(params: {
  user: Express.User;
  take?: number;
}): Promise<{
  attendanceRecent: Array<{
    status: string;
    notedAt: string;
    subject: string | null;
    teacher: string | null;
    group: string | null;
    lessonStartsAt: string | null;
  }>;
}> {
  const studentId = params.user.studentId;
  if (!studentId) throw new Error("Student profile not linked");
  assertStudentSelf(params.user, studentId);

  const take = Math.min(Math.max(Number(params.take ?? 10), 1), 50);

  const attendanceRows = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { notedAt: "desc" },
    take,
    select: {
      status: true,
      notedAt: true,
      lesson: {
        select: {
          startsAt: true,
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          group: { select: { name: true } },
        },
      },
    },
  });

  return {
    attendanceRecent: attendanceRows.map((a) => ({
      status: String(a.status),
      notedAt: a.notedAt.toISOString(),
      subject: a.lesson?.subject?.name ?? null,
      teacher: a.lesson?.teacher?.fullName ?? null,
      group: a.lesson?.group?.name ?? null,
      lessonStartsAt: a.lesson?.startsAt
        ? a.lesson.startsAt.toISOString()
        : null,
    })),
  };
}

export async function getStudentGradesRecent(params: {
  user: Express.User;
  take?: number;
}): Promise<{
  gradesRecent: Array<{
    subject: string | null;
    group: string | null;
    score: number | null;
    rawValue: string | null;
    updatedAt: string;
  }>;
}> {
  const studentId = params.user.studentId;
  if (!studentId) throw new Error("Student profile not linked");
  assertStudentSelf(params.user, studentId);

  const take = Math.min(Math.max(Number(params.take ?? 10), 1), 50);

  const gradeRows = await prisma.gradeRecord.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      score: true,
      rawValue: true,
      updatedAt: true,
      gradeBook: {
        select: {
          subject: { select: { name: true } },
          group: { select: { name: true } },
        },
      },
    },
  });

  return {
    gradesRecent: gradeRows.map((g) => ({
      subject: g.gradeBook?.subject?.name ?? null,
      group: g.gradeBook?.group?.name ?? null,
      score: typeof g.score === "number" ? g.score : null,
      rawValue: g.rawValue ?? null,
      updatedAt: g.updatedAt.toISOString(),
    })),
  };
}

export async function getStudentDashboard(params: {
  user: Express.User;
}): Promise<{
  scheduleToday: Array<{
    subject: string | null;
    teacher: string | null;
    room: string | null;
    startTime: string | null;
    endTime: string | null;
  }>;
  attendanceRecent: Array<{
    status: string;
    notedAt: string;
    subject: string | null;
    teacher: string | null;
    group: string | null;
    lessonStartsAt: string | null;
  }>;
  gradesRecent: Array<{
    subject: string | null;
    group: string | null;
    score: number | null;
    rawValue: string | null;
    updatedAt: string;
  }>;
  attendanceSummary: {
    recentCount: number;
    present: number;
    absent: number;
    late: number;
  };
  gradesSummary: {
    recentCount: number;
    avgScore: number | null;
  };
}> {
  const studentId = params.user.studentId;
  if (!studentId) {
    throw new Error("Student profile not linked");
  }
  assertStudentSelf(params.user, studentId);

  const membership = await prisma.studentGroup.findFirst({
    where: { studentId, leftAt: null },
    select: { groupId: true },
    orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
  });

  const weekday = getWeekdayUTC();

  const scheduleRows = membership?.groupId
    ? await prisma.scheduleEntry.findMany({
        where: {
          groupId: membership.groupId,
          weekday,
          OR: [
            { effectiveFrom: null, effectiveTo: null },
            {
              AND: [
                {
                  OR: [
                    { effectiveFrom: null },
                    { effectiveFrom: { lte: new Date() } },
                  ],
                },
                {
                  OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gte: new Date() } },
                  ],
                },
              ],
            },
          ],
        },
        orderBy: [{ timeSlot: { slotNumber: "asc" } }],
        select: {
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          room: { select: { name: true } },
          timeSlot: { select: { startTime: true, endTime: true } },
        },
      })
    : [];

  const scheduleToday = scheduleRows.slice(0, 10).map((r) => ({
    subject: r.subject?.name ?? null,
    teacher: r.teacher?.fullName ?? null,
    room: r.room?.name ?? null,
    startTime: r.timeSlot ? formatDbTime(r.timeSlot.startTime) : null,
    endTime: r.timeSlot ? formatDbTime(r.timeSlot.endTime) : null,
  }));

  const attendanceRows = await prisma.attendance.findMany({
    where: { studentId },
    orderBy: { notedAt: "desc" },
    take: 5,
    select: {
      status: true,
      notedAt: true,
      lesson: {
        select: {
          startsAt: true,
          subject: { select: { name: true } },
          teacher: { select: { fullName: true } },
          group: { select: { name: true } },
        },
      },
    },
  });

  const attendanceRecent = attendanceRows.map((a) => ({
    status: String(a.status),
    notedAt: a.notedAt.toISOString(),
    subject: a.lesson?.subject?.name ?? null,
    teacher: a.lesson?.teacher?.fullName ?? null,
    group: a.lesson?.group?.name ?? null,
    lessonStartsAt: a.lesson?.startsAt ? a.lesson.startsAt.toISOString() : null,
  }));

  const attendanceSummary = {
    recentCount: attendanceRecent.length,
    present: attendanceRecent.filter((r) => r.status === "PRESENT").length,
    absent: attendanceRecent.filter((r) => r.status === "ABSENT").length,
    late: attendanceRecent.filter((r) => r.status === "LATE").length,
  };

  const gradeRows = await prisma.gradeRecord.findMany({
    where: { studentId },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      score: true,
      rawValue: true,
      updatedAt: true,
      gradeBook: {
        select: {
          subject: { select: { name: true } },
          group: { select: { name: true } },
        },
      },
    },
  });

  const gradesRecent = gradeRows.map((g) => ({
    subject: g.gradeBook?.subject?.name ?? null,
    group: g.gradeBook?.group?.name ?? null,
    score: typeof g.score === "number" ? g.score : null,
    rawValue: g.rawValue ?? null,
    updatedAt: g.updatedAt.toISOString(),
  }));

  const scored = gradesRecent
    .map((g) => g.score)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const gradesSummary = {
    recentCount: gradesRecent.length,
    avgScore:
      scored.length > 0
        ? Math.round(
            (scored.reduce((a, c) => a + c, 0) / scored.length) * 100,
          ) / 100
        : null,
  };

  return {
    scheduleToday,
    attendanceRecent,
    gradesRecent,
    attendanceSummary,
    gradesSummary,
  };
}
