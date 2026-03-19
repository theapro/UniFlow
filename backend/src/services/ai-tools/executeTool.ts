import { UserRole } from "@prisma/client";
import type { AiToolName } from "./toolNames";
import {
  assertAuthenticated,
  assertRole,
  assertStudentLinked,
  assertStudentSelf,
  assertTeacherLinked,
  assertTeacherGroupAccess,
  assertTeacherStudentAccess,
  AiAccessError,
} from "./access";
import {
  getStudentAttendance,
  getStudentFullContext,
  getStudentGroupSubjects,
  getStudentGrades,
  getStudentGroup,
  getStudentProfile,
  getStudentSchedule,
  getStudentMonthlySchedule,
} from "./student.tools";
import {
  getGroupAttendance,
  getGroupGrades,
  getGroupStudents,
} from "./group.tools";
import {
  getFailingStudents,
  getSystemStats,
  getTopStudents,
} from "./admin.tools";

export type AiToolExecutionContext = {
  user: Express.User | undefined;
};

export type AiToolCall = {
  tool: AiToolName;
  args: Record<string, unknown>;
};

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

export async function executeAiTool(
  ctx: AiToolExecutionContext,
  call: AiToolCall,
) {
  assertAuthenticated(ctx.user);

  switch (call.tool) {
    case "getStudentProfile": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      // Students: self-only
      assertStudentSelf(ctx.user, studentId);

      // Teachers: only students in their groups
      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentProfile(studentId);
    }

    case "getStudentFullContext": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentFullContext(studentId);
    }

    case "getStudentGroupSubjects": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentGroupSubjects(studentId);
    }

    case "getStudentGrades": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentGrades(studentId);
    }

    case "getStudentAttendance": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentAttendance(studentId);
    }

    case "getStudentGroup": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentGroup(studentId);
    }

    case "getStudentSchedule": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      return getStudentSchedule(studentId);
    }

    case "getStudentMonthlySchedule": {
      const studentId =
        asString(call.args.studentId) || assertStudentLinked(ctx.user);

      assertStudentSelf(ctx.user, studentId);

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherStudentAccess({ teacherId, studentId });
      }

      const month = asNumber(call.args.month);
      const year = asNumber(call.args.year);

      return getStudentMonthlySchedule({
        studentId,
        month: Number.isFinite(month) ? month : undefined,
        year: Number.isFinite(year) ? year : undefined,
      });
    }

    case "getGroupStudents": {
      const groupId = asString(call.args.groupId);
      if (!groupId)
        throw new AiAccessError("BAD_REQUEST", "groupId is required");

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherGroupAccess({ teacherId, groupId });
      }

      if (ctx.user.role === UserRole.STUDENT) {
        throw new AiAccessError(
          "FORBIDDEN",
          "Students cannot access group rosters",
        );
      }

      return getGroupStudents(groupId);
    }

    case "getGroupGrades": {
      const groupId = asString(call.args.groupId);
      if (!groupId)
        throw new AiAccessError("BAD_REQUEST", "groupId is required");

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherGroupAccess({ teacherId, groupId });
      }

      if (ctx.user.role === UserRole.STUDENT) {
        throw new AiAccessError(
          "FORBIDDEN",
          "Students cannot access group grades",
        );
      }

      return getGroupGrades(groupId);
    }

    case "getGroupAttendance": {
      const groupId = asString(call.args.groupId);
      if (!groupId)
        throw new AiAccessError("BAD_REQUEST", "groupId is required");

      if (ctx.user.role === UserRole.TEACHER) {
        const teacherId = assertTeacherLinked(ctx.user);
        await assertTeacherGroupAccess({ teacherId, groupId });
      }

      if (ctx.user.role === UserRole.STUDENT) {
        throw new AiAccessError(
          "FORBIDDEN",
          "Students cannot access group attendance",
        );
      }

      return getGroupAttendance(groupId);
    }

    case "getTopStudents": {
      assertRole(ctx.user, [UserRole.ADMIN]);
      const limit = asNumber(call.args.limit);
      return getTopStudents(Number.isFinite(limit) ? limit : 10);
    }

    case "getFailingStudents": {
      assertRole(ctx.user, [UserRole.ADMIN]);
      return getFailingStudents();
    }

    case "getSystemStats": {
      assertRole(ctx.user, [UserRole.ADMIN]);
      return getSystemStats();
    }

    default: {
      // Exhaustive
      const _exhaustive: never = call.tool;
      return _exhaustive;
    }
  }
}

// Optional helper for teacher -> student lookups.
// Not a public tool: used only when a teacher requests student-specific data.
export async function assertTeacherCanAccessStudent(
  ctx: AiToolExecutionContext,
  studentId: string,
) {
  assertAuthenticated(ctx.user);
  if (ctx.user.role !== UserRole.TEACHER) return;
  const teacherId = assertTeacherLinked(ctx.user);
  await assertTeacherStudentAccess({ teacherId, studentId });
}
