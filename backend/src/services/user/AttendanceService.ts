import type { AttendanceStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class AttendanceService {
  async markAttendance(
    lessonId: string,
    studentId: string,
    status: AttendanceStatus,
  ) {
    return prisma.attendance.upsert({
      where: {
        lessonId_studentId: {
          lessonId,
          studentId,
        },
      },
      update: { status },
      create: {
        lessonId,
        studentId,
        status,
      },
      include: {
        student: true,
        lesson: {
          include: {
            subject: true,
            group: true,
          },
        },
      },
    });
  }

  async getAttendanceByLesson(lessonId: string) {
    return prisma.attendance.findMany({
      where: { lessonId },
      include: {
        student: true,
      },
      orderBy: { student: { fullName: "asc" } },
    });
  }
}
