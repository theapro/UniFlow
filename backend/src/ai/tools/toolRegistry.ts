import { Role } from "@prisma/client";
import type { AiToolName } from "../../services/ai-tools/toolNames";
import {
  getStudentAttendanceRecent,
  getStudentDashboard,
  getStudentGradesRecent,
  getStudentProfile,
  getStudentScheduleToday,
} from "./studentTools";
import {
  getMonthlySchedule,
  getTodaySchedule,
  getWeeklySchedule,
} from "./scheduleTools";
import { getTeacherDashboard } from "./teacherTools";
import { getSystemStats } from "./adminTools";
import type { TeacherService } from "../../services/user/TeacherService";

export type AiToolDefinition = {
  name: AiToolName;
  description: string;
  allowedRoles: Role[];
  argsSchema: Record<string, any>;
};

export const TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: "getStudentProfile",
    description:
      "Returns the current student's profile (name, student number, contact info, status, group).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {},
  },
  {
    name: "getStudentScheduleToday",
    description: "Returns only today's schedule for the current student.",
    allowedRoles: [Role.STUDENT],
    argsSchema: {},
  },
  {
    name: "getTodaySchedule",
    description:
      "Returns today's schedule rows for the current student (Schedule table, filtered by the student's active group(s) and calendarDay.date).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {
      userId: {
        type: "string",
        description: "Optional. Defaults to the current authenticated user.",
        optional: true,
      },
    },
  },
  {
    name: "getWeeklySchedule",
    description:
      "Returns this week's schedule rows for the current student (Mon-Sun, Schedule table, filtered by the student's active group(s) and calendarDay.date).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {
      userId: {
        type: "string",
        description: "Optional. Defaults to the current authenticated user.",
        optional: true,
      },
    },
  },
  {
    name: "getMonthlySchedule",
    description:
      "Returns this month's schedule rows for the current student (Schedule table, filtered by the student's active group(s) and calendarDay.date).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {
      userId: {
        type: "string",
        description: "Optional. Defaults to the current authenticated user.",
        optional: true,
      },
    },
  },
  {
    name: "getStudentAttendanceRecent",
    description:
      "Returns the current student's recent attendance entries (default 10).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {
      take: {
        type: "number",
        description: "How many items to return (1..50).",
        optional: true,
      },
    },
  },
  {
    name: "getStudentGradesRecent",
    description:
      "Returns the current student's recent grade records (default 10).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {
      take: {
        type: "number",
        description: "How many items to return (1..50).",
        optional: true,
      },
    },
  },
  {
    name: "getStudentDashboard",
    description:
      "Returns student dashboard data: today schedule + last 5 attendance + last 5 grades (student-self only).",
    allowedRoles: [Role.STUDENT],
    argsSchema: {},
  },
  {
    name: "getTeacherDashboard",
    description:
      "Returns teacher dashboard data: basic teacher profile + today's lessons (teacher-self only).",
    allowedRoles: [Role.TEACHER],
    argsSchema: {},
  },
  {
    name: "getSystemStats",
    description: "Returns system-wide aggregate counts (admin only).",
    allowedRoles: [Role.ADMIN],
    argsSchema: {},
  },
];

export function listToolDefinitions(): AiToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export async function runTool(params: {
  name: AiToolName;
  user: Express.User;
  args: Record<string, unknown>;
  teacherService: TeacherService;
}): Promise<unknown> {
  switch (params.name) {
    case "getStudentProfile":
      return getStudentProfile({ user: params.user });
    case "getStudentScheduleToday":
      return getStudentScheduleToday({ user: params.user });
    case "getTodaySchedule": {
      const userIdArg =
        typeof (params.args as any)?.userId === "string"
          ? String((params.args as any).userId)
          : null;
      const userId = userIdArg && userIdArg === params.user.id ? userIdArg : params.user.id;
      return getTodaySchedule({ userId });
    }
    case "getWeeklySchedule": {
      const userIdArg =
        typeof (params.args as any)?.userId === "string"
          ? String((params.args as any).userId)
          : null;
      const userId = userIdArg && userIdArg === params.user.id ? userIdArg : params.user.id;
      return getWeeklySchedule({ userId });
    }
    case "getMonthlySchedule": {
      const userIdArg =
        typeof (params.args as any)?.userId === "string"
          ? String((params.args as any).userId)
          : null;
      const userId = userIdArg && userIdArg === params.user.id ? userIdArg : params.user.id;
      return getMonthlySchedule({ userId });
    }
    case "getStudentAttendanceRecent":
      return getStudentAttendanceRecent({
        user: params.user,
        take:
          typeof (params.args as any)?.take === "number"
            ? ((params.args as any).take as number)
            : undefined,
      });
    case "getStudentGradesRecent":
      return getStudentGradesRecent({
        user: params.user,
        take:
          typeof (params.args as any)?.take === "number"
            ? ((params.args as any).take as number)
            : undefined,
      });
    case "getStudentDashboard":
      return getStudentDashboard({ user: params.user });
    case "getTeacherDashboard":
      return getTeacherDashboard({
        user: params.user,
        teacherService: params.teacherService,
      });
    case "getSystemStats":
      return getSystemStats({ user: params.user });
  }
}
