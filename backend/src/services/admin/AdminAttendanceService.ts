import type { AttendanceStatus, Prisma } from "@prisma/client";
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
    return prisma.attendance.create({
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
  }

  async update(id: string, input: UpdateAttendanceInput) {
    return prisma.attendance.update({
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

    return prisma.$transaction(operations);
  }
}
