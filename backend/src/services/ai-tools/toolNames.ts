export const AI_TOOL_NAMES = [
  "getStudentProfile",
  "getStudentScheduleToday",
  "getStudentAttendanceRecent",
  "getStudentGradesRecent",
  "getStudentDashboard",
  "getTeacherDashboard",
  "getSystemStats",
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];
