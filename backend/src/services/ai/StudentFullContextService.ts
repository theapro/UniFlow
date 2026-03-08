import { prisma } from "../../config/prisma";

export type StudentFullContext = {
  meta: {
    generatedAt: string;
    now: string;
    todayWeekday: string;
  };
  student: {
    id: string;
    name: string;
    studentNo: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  group: {
    id: string;
    name: string;
    cohort: { id: string; year: number } | null;
  } | null;
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
  subjects: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; name: string }>;
  groupSubjects: Array<{
    subject: { id: string; name: string };
    teachers: Array<{ id: string; name: string }>;
    hasSchedule: boolean;
    hasAttendanceLessons: boolean;
    hasGrades: boolean;
  }>;
  schedule: Array<{
    day: string;
    time: string | null;
    subject: { id: string; name: string } | null;
    teacher: { id: string; name: string } | null;
    room: { id: string; name: string } | null;
  }>;
  todaySchedule: Array<{
    day: string;
    time: string | null;
    subject: { id: string; name: string } | null;
    teacher: { id: string; name: string } | null;
    room: { id: string; name: string } | null;
  }>;
  nextLessons: Array<{
    startsAtApprox: string;
    day: string;
    time: string | null;
    subject: { id: string; name: string } | null;
    teacher: { id: string; name: string } | null;
    room: { id: string; name: string } | null;
  }>;
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    rate: number | null;
    recent: Array<{
      status: string;
      notedAt: Date;
      lesson: {
        startsAt: Date;
        endsAt: Date;
        subject: { id: string; name: string };
        teacher: { id: string; name: string };
      };
    }>;
  };
  grades: Array<{
    subject: { id: string; name: string };
    group: { id: string; name: string };
    assignment: number;
    score: number | null;
    rawValue: string | null;
    updatedAt: Date;
  }>;
};

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

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it?.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function parseTimeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = String(hhmm)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function jsDayToWeekday(d: number): string {
  // JS: 0=Sun..6=Sat. DB enum: MON..SUN
  if (d === 0) return "SUN";
  if (d === 1) return "MON";
  if (d === 2) return "TUE";
  if (d === 3) return "WED";
  if (d === 4) return "THU";
  if (d === 5) return "FRI";
  return "SAT";
}

function weekdayToJsDay(w: string): number {
  const s = String(w).toUpperCase();
  if (s === "SUN") return 0;
  if (s === "MON") return 1;
  if (s === "TUE") return 2;
  if (s === "WED") return 3;
  if (s === "THU") return 4;
  if (s === "FRI") return 5;
  if (s === "SAT") return 6;
  return 0;
}

export class StudentFullContextService {
  /**
   * Returns a compact but relationally complete student context.
   * NOTE: This is intentionally a SINGLE Prisma query (with includes)
   * to avoid tool-time N+1 and keep AI answers grounded in DB state.
   */
  async getStudentFullContext(
    studentId: string,
  ): Promise<StudentFullContext | null> {
    const row = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        group: {
          include: {
            cohort: { select: { id: true, year: true } },
            gradeBooks: {
              select: {
                id: true,
                subject: { select: { id: true, name: true } },
                updatedAt: true,
              },
              orderBy: { updatedAt: "desc" },
              take: 50,
            },
            scheduleEntries: {
              include: {
                subject: { select: { id: true, name: true } },
                teacher: { select: { id: true, fullName: true } },
                timeSlot: {
                  select: {
                    id: true,
                    order: true,
                    startTime: true,
                    endTime: true,
                  },
                },
                room: { select: { id: true, name: true } },
              },
              orderBy: [{ weekday: "asc" }, { timeSlot: { order: "asc" } }],
            },
          },
        },
        attendance: {
          include: {
            lesson: {
              select: {
                startsAt: true,
                endsAt: true,
                subject: { select: { id: true, name: true } },
                teacher: { select: { id: true, fullName: true } },
              },
            },
          },
          orderBy: { notedAt: "desc" },
        },
        gradeRecords: {
          include: {
            gradeBook: {
              select: {
                id: true,
                group: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { assignmentIndex: "asc" }],
        },
      },
    });

    if (!row) return null;

    const scheduleEntries = row.group?.scheduleEntries ?? [];

    const gradeBookSubjects = uniqById(
      (row.group?.gradeBooks ?? [])
        .map((b) => b.subject)
        .filter((s): s is { id: string; name: string } => Boolean(s?.id)),
    );

    const attendanceRows = row.attendance ?? [];
    const attendanceSubjects = uniqById(
      attendanceRows
        .map((r) => r.lesson?.subject)
        .filter((s): s is { id: string; name: string } => Boolean(s?.id)),
    );

    const scheduleSubjects = scheduleEntries
      .map((e) => e.subject)
      .filter((s): s is { id: string; name: string } => Boolean(s?.id));

    const subjects = uniqById([
      ...scheduleSubjects,
      ...gradeBookSubjects,
      ...attendanceSubjects,
    ]);

    const scheduleTeachers = scheduleEntries
      .map((e) => e.teacher)
      .filter((t): t is { id: string; fullName: string } => Boolean(t?.id))
      .map((t) => ({ id: t.id, name: t.fullName }));

    const attendanceTeachers = attendanceRows
      .map((r) => r.lesson?.teacher)
      .filter((t): t is { id: string; fullName: string } => Boolean(t?.id))
      .map((t) => ({ id: t.id, name: t.fullName }));

    // Fallback teachers via Subject<->Teacher mapping (kept in sync by workers).
    const subjectIds = subjects.map((s) => s.id);
    const subjectTeachersRows = subjectIds.length
      ? await prisma.subject.findMany({
          where: { id: { in: subjectIds } },
          select: {
            id: true,
            teachers: { select: { id: true, fullName: true }, take: 10 },
          },
        })
      : [];

    const fallbackTeachersBySubjectId = new Map<
      string,
      Array<{ id: string; name: string }>
    >(
      subjectTeachersRows.map((r) => [
        r.id,
        (r.teachers ?? []).map((t) => ({ id: t.id, name: t.fullName })),
      ]),
    );

    const subjectTeachersAll = subjectTeachersRows
      .flatMap((r) => r.teachers ?? [])
      .map((t) => ({ id: t.id, name: t.fullName }));

    const teachers = uniqById([
      ...scheduleTeachers,
      ...attendanceTeachers,
      ...subjectTeachersAll,
    ]);

    const schedule = scheduleEntries.map((e) => ({
      day: String(e.weekday),
      time: e.timeSlot ? `${e.timeSlot.startTime}-${e.timeSlot.endTime}` : null,
      subject: e.subject ? { id: e.subject.id, name: e.subject.name } : null,
      teacher: e.teacher
        ? { id: e.teacher.id, name: e.teacher.fullName }
        : null,
      room: e.room ? { id: e.room.id, name: e.room.name } : null,
    }));

    const now = new Date();
    const nowIso = now.toISOString();
    const todayWeekday = jsDayToWeekday(now.getDay());
    const todaySchedule = schedule.filter((s) =>
      String(s.day).toUpperCase().startsWith(todayWeekday),
    );

    const nextLessons = schedule
      .map((s) => {
        const jsTarget = weekdayToJsDay(s.day);
        const todayJs = now.getDay();
        let daysAhead = (jsTarget - todayJs + 7) % 7;

        // If today, but time already passed, push to next week.
        const startMin = s.time
          ? parseTimeToMinutes(s.time.split("-")[0])
          : null;
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (daysAhead === 0 && startMin !== null && startMin <= nowMin) {
          daysAhead = 7;
        }

        const dt = new Date(now);
        dt.setDate(dt.getDate() + daysAhead);
        if (startMin !== null) {
          dt.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
        } else {
          dt.setHours(12, 0, 0, 0);
        }

        return { ...s, startsAtApprox: dt.toISOString() };
      })
      .sort((a, b) => a.startsAtApprox.localeCompare(b.startsAtApprox))
      .slice(0, 10);

    const total = attendanceRows.length;
    const present = attendanceRows.filter((r) => r.status === "PRESENT").length;
    const absent = attendanceRows.filter((r) => r.status === "ABSENT").length;
    const late = attendanceRows.filter((r) => r.status === "LATE").length;
    const excused = attendanceRows.filter((r) => r.status === "EXCUSED").length;

    const rate = total > 0 ? Math.round((present / total) * 100) : null;

    const recentAttendance = attendanceRows.slice(0, 50).map((r) => ({
      status: String(r.status),
      notedAt: r.notedAt,
      lesson: {
        startsAt: r.lesson.startsAt,
        endsAt: r.lesson.endsAt,
        subject: { id: r.lesson.subject.id, name: r.lesson.subject.name },
        teacher: { id: r.lesson.teacher.id, name: r.lesson.teacher.fullName },
      },
    }));

    const grades = (row.gradeRecords ?? [])
      .filter(
        (gr) =>
          Boolean(gr.gradeBook?.subject?.id) &&
          Boolean(gr.gradeBook?.group?.id),
      )
      .map((gr) => ({
        subject: {
          id: gr.gradeBook.subject.id,
          name: gr.gradeBook.subject.name,
        },
        group: {
          id: gr.gradeBook.group.id,
          name: gr.gradeBook.group.name,
        },
        assignment: Number(gr.assignmentIndex),
        score:
          typeof gr.score === "number" && Number.isFinite(gr.score)
            ? gr.score
            : null,
        rawValue: gr.rawValue ?? null,
        updatedAt: gr.updatedAt,
      }));

    // Build group-subject -> teacher(s) mapping from schedule + attendance lessons.
    const teacherIdsBySubjectId = new Map<string, string[]>();
    for (const e of scheduleEntries) {
      const subjectId = e.subject?.id;
      const teacherId = e.teacher?.id;
      if (!subjectId || !teacherId) continue;
      const prev = teacherIdsBySubjectId.get(subjectId) ?? [];
      teacherIdsBySubjectId.set(subjectId, [...prev, teacherId]);
    }
    for (const a of attendanceRows) {
      const subjectId = a.lesson?.subject?.id;
      const teacherId = a.lesson?.teacher?.id;
      if (!subjectId || !teacherId) continue;
      const prev = teacherIdsBySubjectId.get(subjectId) ?? [];
      teacherIdsBySubjectId.set(subjectId, [...prev, teacherId]);
    }

    const teacherNameById = new Map(
      teachers.map((t) => [t.id, t.name] as const),
    );

    const hasScheduleSubjectIds = new Set(
      scheduleEntries.map((e) => e.subject?.id).filter(Boolean) as string[],
    );
    const hasAttendanceSubjectIds = new Set(
      attendanceRows
        .map((r) => r.lesson?.subject?.id)
        .filter(Boolean) as string[],
    );
    const hasGradesSubjectIds = new Set(
      (row.group?.gradeBooks ?? [])
        .map((b) => b.subject?.id)
        .filter(Boolean) as string[],
    );

    const groupSubjects = subjects.map((subj) => {
      const teacherIds = uniqStrings(teacherIdsBySubjectId.get(subj.id) ?? []);
      const mappedTeachers = teacherIds
        .map((id) => {
          const name = teacherNameById.get(id);
          return name ? { id, name } : null;
        })
        .filter((t): t is { id: string; name: string } => Boolean(t));

      const fallbackTeachers = fallbackTeachersBySubjectId.get(subj.id) ?? [];

      return {
        subject: subj,
        teachers: uniqById(
          mappedTeachers.length > 0 ? mappedTeachers : fallbackTeachers,
        ),
        hasSchedule: hasScheduleSubjectIds.has(subj.id),
        hasAttendanceLessons: hasAttendanceSubjectIds.has(subj.id),
        hasGrades: hasGradesSubjectIds.has(subj.id),
      };
    });

    // Convenience: set singular `subject`/`teacher` only if unambiguous.
    const singleSubject = subjects.length === 1 ? subjects[0] : null;
    const singleTeacher = teachers.length === 1 ? teachers[0] : null;

    return {
      meta: {
        generatedAt: nowIso,
        now: nowIso,
        todayWeekday,
      },
      student: {
        id: row.id,
        name: row.fullName,
        studentNo: row.studentNumber ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        status: row.status ? String(row.status) : null,
      },
      group: row.group
        ? {
            id: row.group.id,
            name: row.group.name,
            cohort: row.group.cohort
              ? { id: row.group.cohort.id, year: row.group.cohort.year }
              : null,
          }
        : null,
      subject: singleSubject,
      teacher: singleTeacher,
      subjects,
      teachers,
      groupSubjects,
      schedule,
      todaySchedule,
      nextLessons,
      attendance: {
        present,
        absent,
        late,
        excused,
        total,
        rate,
        recent: recentAttendance,
      },
      grades,
    };
  }
}
