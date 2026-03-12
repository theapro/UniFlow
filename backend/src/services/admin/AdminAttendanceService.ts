import type { AttendanceStatus, Prisma, Weekday } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type CreateAttendanceInput = {
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
};

export type UpdateAttendanceInput = {
  status?: AttendanceStatus;
};

export class AdminAttendanceService {
  private parseDateInput(value: string): Date {
    const v = String(value ?? "").trim();
    if (!v) throw new Error("INVALID_DATE");

    // Prefer YYYY-MM-DD
    const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    const d = isoDay ? new Date(v + "T00:00:00") : new Date(v);
    if (!Number.isFinite(d.getTime())) throw new Error("INVALID_DATE");
    return d;
  }

  private clampToDayStart(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }

  private clampToDayEndExclusive(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  }

  private weekdayFromDate(d: Date): Weekday {
    const day = d.getDay();
    switch (day) {
      case 0:
        return "SUN";
      case 1:
        return "MON";
      case 2:
        return "TUE";
      case 3:
        return "WED";
      case 4:
        return "THU";
      case 5:
        return "FRI";
      case 6:
        return "SAT";
      default:
        return "MON";
    }
  }

  private parseTimeToParts(
    value: string | Date | null | undefined,
  ): { hh: number; mm: number } | null {
    if (value instanceof Date) {
      const hh = value.getUTCHours();
      const mm = value.getUTCMinutes();
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return { hh, mm };
    }
    const v = String(value ?? "").trim();
    if (!v) return null;
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }

  private dateAtLocalTime(dateOnly: Date, hh: number, mm: number): Date {
    return new Date(
      dateOnly.getFullYear(),
      dateOnly.getMonth(),
      dateOnly.getDate(),
      hh,
      mm,
      0,
      0,
    );
  }

  private async findLessonIdForDate(opts: {
    groupId: string;
    subjectId: string;
    date: Date;
  }): Promise<string | null> {
    const dayStart = this.clampToDayStart(opts.date);
    const dayEnd = this.clampToDayEndExclusive(opts.date);

    const existing = await prisma.lesson.findFirst({
      where: {
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
      orderBy: { startsAt: "asc" },
    });

    return existing?.id ?? null;
  }

  private async getOrCreateLessonIdForDate(opts: {
    groupId: string;
    subjectId: string;
    date: Date;
  }): Promise<string> {
    // Validate refs early (cleaner error messages)
    const [group, subject] = await Promise.all([
      prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { id: true },
      }),
      prisma.subject.findUnique({
        where: { id: opts.subjectId },
        select: { id: true, teachers: { select: { id: true }, take: 1 } },
      }),
    ]);
    if (!group) throw new Error("GROUP_NOT_FOUND");
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const existingId = await this.findLessonIdForDate(opts);
    if (existingId) return existingId;

    const weekday = this.weekdayFromDate(opts.date);

    const picked = await prisma.scheduleEntry.findFirst({
      where: {
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        weekday,
      },
      include: { timeSlot: true, room: true },
      orderBy: { timeSlot: { slotNumber: "asc" } },
    });

    const teacherId = picked?.teacherId ?? subject.teachers?.[0]?.id ?? null;
    if (!teacherId) throw new Error("MISSING_TEACHER_FOR_LESSON");

    let startParts = this.parseTimeToParts(picked?.timeSlot?.startTime ?? null);
    let endParts = this.parseTimeToParts(picked?.timeSlot?.endTime ?? null);
    if (!startParts) startParts = { hh: 9, mm: 0 };
    if (!endParts) endParts = { hh: 10, mm: 0 };

    const startsAt = this.dateAtLocalTime(
      opts.date,
      startParts.hh,
      startParts.mm,
    );
    const endsAt = this.dateAtLocalTime(opts.date, endParts.hh, endParts.mm);

    const created = await prisma.lesson.create({
      data: {
        startsAt,
        endsAt,
        room: picked?.room?.name ?? null,
        groupId: opts.groupId,
        teacherId,
        subjectId: opts.subjectId,
      },
      select: { id: true },
    });

    return created.id;
  }

  async list(params?: {
    lessonId?: string;
    studentId?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.AttendanceWhereInput = {
      ...(params?.lessonId ? { lessonId: params.lessonId } : {}),
      ...(params?.studentId ? { studentId: params.studentId } : {}),
    };

    return prisma.attendance.findMany({
      where,
      include: {
        lesson: {
          include: {
            subject: true,
            teacher: true,
            group: true,
          },
        },
        student: true,
      },
      orderBy: { notedAt: "desc" },
      take: params?.take ?? 100,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.attendance.findUnique({
      where: { id },
      include: {
        lesson: {
          include: {
            subject: true,
            teacher: true,
            group: true,
          },
        },
        student: true,
      },
    });
  }

  async create(input: CreateAttendanceInput) {
    const record = await prisma.attendance.create({
      data: {
        lessonId: input.lessonId,
        studentId: input.studentId,
        status: input.status,
      },
      include: {
        lesson: {
          include: {
            subject: true,
            teacher: true,
            group: true,
          },
        },
        student: true,
      },
    });

    // Legacy Sheets analytics sync removed.

    return record;
  }

  async update(id: string, input: UpdateAttendanceInput) {
    const record = await prisma.attendance.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        lesson: {
          include: {
            subject: true,
            teacher: true,
            group: true,
          },
        },
        student: true,
      },
    });

    // Legacy Sheets analytics sync removed.

    return record;
  }

  async remove(id: string) {
    await prisma.attendance.delete({ where: { id } });
    return true;
  }

  async bulkMarkAttendance(
    lessonId: string,
    records: { studentId: string; status: AttendanceStatus }[],
  ) {
    const operations = records.map((record) =>
      prisma.attendance.upsert({
        where: {
          lessonId_studentId: {
            lessonId,
            studentId: record.studentId,
          },
        },
        update: { status: record.status },
        create: {
          lessonId,
          studentId: record.studentId,
          status: record.status,
        },
      }),
    );

    const result = await prisma.$transaction(operations);

    // Legacy Sheets analytics sync removed.

    return result;
  }

  async getAttendanceByDate(opts: {
    groupId: string;
    subjectId: string;
    date: string;
  }) {
    const parsedDate = this.parseDateInput(opts.date);
    const lessonId = await this.findLessonIdForDate({
      groupId: opts.groupId,
      subjectId: opts.subjectId,
      date: parsedDate,
    });

    if (!lessonId) return [];

    return prisma.attendance.findMany({
      where: { lessonId },
      select: { id: true, studentId: true, status: true },
      orderBy: { notedAt: "desc" },
      take: 5000,
    });
  }

  async bulkMarkAttendanceByDate(opts: {
    groupId: string;
    subjectId: string;
    date: string;
    records: { studentId: string; status: AttendanceStatus | "" }[];
  }) {
    const parsedDate = this.parseDateInput(opts.date);
    const lessonId = await this.getOrCreateLessonIdForDate({
      groupId: opts.groupId,
      subjectId: opts.subjectId,
      date: parsedDate,
    });

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    for (const r of opts.records ?? []) {
      const studentId = String(r?.studentId ?? "").trim();
      const status = r?.status;
      if (!studentId) continue;

      if (status) {
        operations.push(
          prisma.attendance.upsert({
            where: { lessonId_studentId: { lessonId, studentId } },
            create: { lessonId, studentId, status },
            update: { status, notedAt: new Date() },
            select: { id: true },
          }),
        );
      } else {
        operations.push(
          prisma.attendance.deleteMany({
            where: { lessonId, studentId },
          }),
        );
      }
    }

    return prisma.$transaction(operations);
  }
}
