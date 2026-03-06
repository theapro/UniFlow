export const STUDENTS_SHEET_COLUMNS = [
  "student_uuid",
  "student_number",
  "fullname",
  "email",
  "phone",
  "status",
  "teacher_ids",
  "parent_ids",
  "cohort",
  "created_at",
  "updated_at",
  "note",
] as const;

export type StudentsSheetColumn = (typeof STUDENTS_SHEET_COLUMNS)[number];
