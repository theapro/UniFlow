export const AI_TOOL_NAMES = [
  "getStudentProfile",
  "getStudentFullContext",
  "getStudentGroupSubjects",
  "getStudentGrades",
  "getStudentAttendance",
  "getStudentGroup",
  "getStudentSchedule",
  "getStudentMonthlySchedule",

  "getGroupStudents",
  "getGroupGrades",
  "getGroupAttendance",

  "getTopStudents",
  "getFailingStudents",
  "getSystemStats",
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];
