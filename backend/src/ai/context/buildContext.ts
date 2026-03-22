import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ChatSender } from "@prisma/client";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";
import type { AiBuiltContext, AiUserIdentity } from "../types";

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function buildContext(params: {
  user: Express.User;
  sessionId: string | null;
  contextLimit: number;
  studentService: StudentService;
  teacherService: TeacherService;
}): Promise<AiBuiltContext> {
  const identity: AiUserIdentity = {
    userId: safeString(params.user.id),
    role: params.user.role,
    email: safeString(params.user.email),
    fullName: params.user.fullName ?? null,
    studentId: params.user.studentId ?? null,
    teacherId: params.user.teacherId ?? null,
  };

  const [student, teacher, recentChats] = await Promise.all([
    params.user.studentId
      ? prisma.student.findUnique({
          where: { id: params.user.studentId },
          select: {
            id: true,
            fullName: true,
            studentNumber: true,
            studentGroups: {
              where: { leftAt: null },
              select: { group: { select: { id: true, name: true } } },
              orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
    params.user.teacherId
      ? prisma.teacher.findUnique({
          where: { id: params.user.teacherId },
          select: {
            id: true,
            fullName: true,
            staffNo: true,
            department: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve(null),
    params.sessionId
      ? prisma.chat.findMany({
          where: { userId: identity.userId, sessionId: params.sessionId },
          orderBy: { timestamp: "desc" },
          take: Math.min(Math.max(params.contextLimit, 0), 20),
          select: { sender: true, message: true },
        })
      : Promise.resolve([]),
  ]);

  const recentMessages = recentChats
    .reverse()
    .map((row) => ({
      role:
        row.sender === ChatSender.USER
          ? ("user" as const)
          : ("assistant" as const),
      content: row.message,
    }))
    .filter((m) => m.content.trim().length > 0);

  let today: AiBuiltContext["today"] = null;

  if (identity.role === Role.STUDENT && identity.studentId) {
    try {
      const schedule = await params.studentService.getTodaySchedule(
        identity.studentId,
      );
      today = {
        kind: "student_schedule",
        scheduleToday: schedule.slice(0, 10).map((s: any) => ({
          subject: s?.subject?.name ?? null,
          teacher: s?.teacher?.fullName ?? null,
          room: s?.room?.name ?? null,
          startTime: s?.timeSlot?.startTime ?? null,
          endTime: s?.timeSlot?.endTime ?? null,
        })),
      };
    } catch {
      today = null;
    }
  }

  if (identity.role === Role.TEACHER && identity.teacherId) {
    try {
      const lessons = await params.teacherService.getTodayLessons(
        identity.teacherId,
      );
      today = {
        kind: "teacher_lessons",
        lessonsToday: lessons.slice(0, 10).map((l: any) => ({
          subject: l?.subject?.name ?? null,
          group: l?.group?.name ?? null,
          startsAt: l?.startsAt ? new Date(l.startsAt).toISOString() : null,
          endsAt: l?.endsAt ? new Date(l.endsAt).toISOString() : null,
        })),
      };
    } catch {
      today = null;
    }
  }

  return {
    identity,
    student: student
      ? {
          id: student.id,
          fullName: student.fullName,
          studentNumber: student.studentNumber ?? null,
          group: student.studentGroups[0]?.group ?? null,
        }
      : null,
    teacher: teacher
      ? {
          id: teacher.id,
          fullName: teacher.fullName,
          staffNo: teacher.staffNo ?? null,
          department: teacher.department,
        }
      : null,
    today,
    recentMessages,
  };
}
