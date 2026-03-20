import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class AiAccessError extends Error {
  constructor(
    public readonly code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "BAD_REQUEST"
      | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export function assertAuthenticated(
  user: Express.User | undefined,
): asserts user is Express.User {
  if (!user?.id) throw new AiAccessError("UNAUTHORIZED", "Unauthorized");
}

export function assertRole(user: Express.User, roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new AiAccessError("FORBIDDEN", "Forbidden");
  }
}

export function assertStudentSelf(user: Express.User, studentId: string): void {
  if (user.role !== UserRole.STUDENT) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Only students can access student-self tools",
    );
  }
  if (!user.studentId) {
    throw new AiAccessError("BAD_REQUEST", "Student profile not linked");
  }
  if (user.studentId !== studentId) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Students can only access their own data",
    );
  }
}

export async function assertTeacherGroupAccess(params: {
  user: Express.User;
  groupId: string;
}): Promise<void> {
  if (params.user.role !== UserRole.TEACHER) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Only teachers can access teacher-group tools",
    );
  }
  if (!params.user.teacherId) {
    throw new AiAccessError("BAD_REQUEST", "Teacher profile not linked");
  }

  const can = await prisma.lesson.findFirst({
    where: {
      teacherId: params.user.teacherId,
      groupId: params.groupId,
    },
    select: { id: true },
  });

  if (!can) {
    throw new AiAccessError("FORBIDDEN", "Teacher has no access to this group");
  }
}

export async function assertTeacherStudentAccess(params: {
  user: Express.User;
  studentId: string;
}): Promise<void> {
  if (params.user.role !== UserRole.TEACHER) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Only teachers can access teacher-student tools",
    );
  }
  if (!params.user.teacherId) {
    throw new AiAccessError("BAD_REQUEST", "Teacher profile not linked");
  }

  const can = await prisma.attendance.findFirst({
    where: {
      studentId: params.studentId,
      lesson: { teacherId: params.user.teacherId },
    },
    select: { id: true },
  });

  if (!can) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Teacher has no access to this student",
    );
  }
}
