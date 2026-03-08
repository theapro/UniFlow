import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function optionalNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function optionalBool(name: string): boolean | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return undefined;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  // LLM / Groq (optional unless /api/ai/llm/chat is used)
  groqApiKey: optional("GROQ_API_KEY"),
  groqModel: optional("GROQ_MODEL"),
  groqApiUrl: optional("GROQ_API_URL"),
  aiContextLimit: Number(process.env.AI_CONTEXT_LIMIT ?? 15),
  aiMaxTokens: Number(process.env.AI_MAX_TOKENS ?? 2048),

  // Google Sign-In (ID token verification)
  googleClientId: optional("GOOGLE_CLIENT_ID"),

  // Email (Resend)
  resendApiKey: optional("RESEND_API_KEY"),
  resendFromEmail: optional("RESEND_FROM_EMAIL"),
  userAppUrl: optional("USER_APP_URL"),

  // --- Google Sheets (Students Spreadsheet) ---
  // Service Account credentials (shared across all spreadsheets)
  googleSheetsClientEmail: optional("GOOGLE_SHEETS_CLIENT_EMAIL"),
  // Prefer BASE64 in CI/secrets; fallback supports literal key with \n.
  googleSheetsPrivateKeyBase64: optional("GOOGLE_SHEETS_PRIVATE_KEY_BASE64"),
  googleSheetsPrivateKey: optional("GOOGLE_SHEETS_PRIVATE_KEY"),

  // Students Spreadsheet (tabs = groups)
  studentsSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_STUDENTS_ENABLED") ??
    Boolean(optional("GOOGLE_SHEETS_STUDENTS_SPREADSHEET_ID")),
  studentsSheetsSpreadsheetId: optional(
    "GOOGLE_SHEETS_STUDENTS_SPREADSHEET_ID",
  ),

  // Teachers Spreadsheet (TeachersWithSubjects; tabs = subjects)
  teachersSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_TEACHERS_ENABLED") ??
    Boolean(optional("GOOGLE_SHEETS_TEACHERS_SPREADSHEET_ID")),
  teachersSheetsSpreadsheetId: optional(
    "GOOGLE_SHEETS_TEACHERS_SPREADSHEET_ID",
  ),

  // Attendance Spreadsheet (tabs = GROUP_SUBJECT)
  attendanceSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_ATTENDANCE_ENABLED") ??
    Boolean(optional("GOOGLE_SHEETS_ATTENDANCE_SPREADSHEET_ID")),
  attendanceSheetsSpreadsheetId: optional(
    "GOOGLE_SHEETS_ATTENDANCE_SPREADSHEET_ID",
  ),

  // Grades Spreadsheet (Baholash; tabs = GROUP_SUBJECT)
  gradesSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_GRADES_ENABLED") ??
    Boolean(optional("GOOGLE_SHEETS_GRADES_SPREADSHEET_ID")),
  gradesSheetsSpreadsheetId: optional("GOOGLE_SHEETS_GRADES_SPREADSHEET_ID"),

  // Teachers Worker
  teachersSheetsWorkerEnabled:
    optionalBool("GOOGLE_SHEETS_TEACHERS_WORKER_ENABLED") ?? false,
  teachersSheetsWorkerIntervalMs:
    optionalNumber("GOOGLE_SHEETS_TEACHERS_WORKER_INTERVAL_MS") ?? 60_000,
  teachersSheetsDbToSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_TEACHERS_DB_TO_SHEETS_ENABLED") ?? true,

  // Attendance Worker
  attendanceSheetsWorkerEnabled:
    optionalBool("GOOGLE_SHEETS_ATTENDANCE_WORKER_ENABLED") ?? false,
  attendanceSheetsWorkerIntervalMs:
    optionalNumber("GOOGLE_SHEETS_ATTENDANCE_WORKER_INTERVAL_MS") ?? 60_000,
  attendanceSheetsDbToSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_ATTENDANCE_DB_TO_SHEETS_ENABLED") ?? true,

  // Optional background sync loop (recommended: run a separate worker in prod)
  studentsSheetsWorkerEnabled:
    optionalBool("GOOGLE_SHEETS_STUDENTS_WORKER_ENABLED") ?? false,
  studentsSheetsWorkerIntervalMs:
    optionalNumber("GOOGLE_SHEETS_STUDENTS_WORKER_INTERVAL_MS") ?? 60_000,

  // Optional webhook trigger (Apps Script onEdit -> POST to backend)
  studentsSheetsWebhookSecret: optional(
    "GOOGLE_SHEETS_STUDENTS_WEBHOOK_SECRET",
  ),

  // Optional webhook trigger (Apps Script onEdit -> POST to backend)
  attendanceSheetsWebhookSecret: optional(
    "GOOGLE_SHEETS_ATTENDANCE_WEBHOOK_SECRET",
  ),

  // Optional behaviors
  studentsSheetsDetectDeletes:
    optionalBool("GOOGLE_SHEETS_STUDENTS_DETECT_DELETES") ?? false,
  studentsSheetsDbToSheetsEnabled:
    optionalBool("GOOGLE_SHEETS_STUDENTS_DB_TO_SHEETS_ENABLED") ?? true,

  // Optional tab filtering (treat only matching tabs as "groups")
  // Example allow regex: ^\\d{2,4}.*$  (tabs starting with year)
  studentsSheetsGroupTabsAllowRegex: optional(
    "GOOGLE_SHEETS_STUDENTS_GROUP_TABS_ALLOW_REGEX",
  ),
  // Example deny regex: ^(?:Sheet\\d+|Summary|Config)$
  studentsSheetsGroupTabsDenyRegex: optional(
    "GOOGLE_SHEETS_STUDENTS_GROUP_TABS_DENY_REGEX",
  ),

  // Optional tab filtering for TeachersWithSubjects (treat only matching tabs as subjects)
  teachersSheetsSubjectTabsAllowRegex: optional(
    "GOOGLE_SHEETS_TEACHERS_SUBJECT_TABS_ALLOW_REGEX",
  ),
  teachersSheetsSubjectTabsDenyRegex: optional(
    "GOOGLE_SHEETS_TEACHERS_SUBJECT_TABS_DENY_REGEX",
  ),

  // Optional tab filtering for Attendance spreadsheet (treat only matching tabs as attendance tabs)
  attendanceSheetsTabsAllowRegex: optional(
    "GOOGLE_SHEETS_ATTENDANCE_TABS_ALLOW_REGEX",
  ),
  attendanceSheetsTabsDenyRegex: optional(
    "GOOGLE_SHEETS_ATTENDANCE_TABS_DENY_REGEX",
  ),

  // Optional tab filtering for Grades spreadsheet (treat only matching tabs as grades tabs)
  gradesSheetsTabsAllowRegex: optional("GOOGLE_SHEETS_GRADES_TABS_ALLOW_REGEX"),
  gradesSheetsTabsDenyRegex: optional("GOOGLE_SHEETS_GRADES_TABS_DENY_REGEX"),

  // Date parsing for attendance headers (default: MM/DD)
  attendanceSheetsDateFormat:
    optional("GOOGLE_SHEETS_ATTENDANCE_DATE_FORMAT") ?? "MM/DD",
};
