import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class AiAccessError extends Error {
  public readonly code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "BAD_REQUEST"
    | "NOT_FOUND";

  constructor(code: AiAccessError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export function assertAuthenticated(
  user: Express.User | undefined,
): asserts user {
  if (!user) throw new AiAccessError("UNAUTHORIZED", "Unauthorized");
}

export function assertRole(user: Express.User, allowed: UserRole[]) {
  if (!allowed.includes(user.role)) {
    throw new AiAccessError("FORBIDDEN", "Forbidden");
  }
}

export function assertStudentLinked(user: Express.User): string {
  if (!user.studentId) {
    throw new AiAccessError("BAD_REQUEST", "Student profile not linked");
  }
  return user.studentId;
}

export function assertTeacherLinked(user: Express.User): string {
  if (!user.teacherId) {
    throw new AiAccessError("BAD_REQUEST", "Teacher profile not linked");
  }
  return user.teacherId;
}

export function assertStudentSelf(user: Express.User, studentId: string) {
  if (user.role !== UserRole.STUDENT) return;
  const self = assertStudentLinked(user);
  if (self !== studentId) {
    throw new AiAccessError(
      "FORBIDDEN",
      "Students can only access their own data",
    );
  }
}

export async function assertTeacherGroupAccess(params: {
  teacherId: string;
  groupId: string;
}) {
  const { teacherId, groupId } = params;
  const hasSchedule = await prisma.scheduleEntry.findFirst({
    where: { teacherId, groupId },
    select: { id: true },
  });

  if (hasSchedule) return;

  const hasLesson = await prisma.lesson.findFirst({
    where: { teacherId, groupId },
    select: { id: true },
  });

  if (hasLesson) return;

  throw new AiAccessError(
    "FORBIDDEN",
    "Teacher can only access groups they teach",
  );
}

export async function assertTeacherStudentAccess(params: {
  teacherId: string;
  studentId: string;
}) {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, groupId: true },
  });

  if (!student) {
    throw new AiAccessError("NOT_FOUND", "Student not found");
  }

  if (!student.groupId) {
    throw new AiAccessError("FORBIDDEN", "Student is not assigned to a group");
  }

  await assertTeacherGroupAccess({
    teacherId: params.teacherId,
    groupId: student.groupId,
  });
}
