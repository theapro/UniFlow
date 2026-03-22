export const AI_TOOL_NAMES = [
  "getStudentProfile",
  "getStudentScheduleToday",
  "getTodaySchedule",
  "getWeeklySchedule",
  "getMonthlySchedule",
  "getStudentAttendanceRecent",
  "getStudentGradesRecent",
  "getStudentDashboard",
  "getTeacherDashboard",
  "getSystemStats",
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];
