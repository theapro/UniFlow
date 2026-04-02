export type CohortMeta = {
  id: string;
  code: string;
  sortOrder: number;
  year: number | null;
};

export type GroupMeta = {
  id: string;
  name: string;
  cohortId: string | null;
};

export type SubjectMeta = {
  id: string;
  name: string;
  cohortId: string | null;
};

export type SchedulePairMeta = {
  groupId: string;
  subjectId: string;
};

export type AttendanceGradesMeta = {
  cohorts: CohortMeta[];
  groups: GroupMeta[];
  subjects: SubjectMeta[];
  schedulePairs: SchedulePairMeta[];
};

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type AttendanceCellValue =
  | AttendanceStatus
  | "P"
  | "A"
  | "L"
  | "E"
  | null;

export type AttendanceTableData = {
  cohortId: string | null;
  group: { id: string; name: string };
  subject: { id: string; name: string };
  dates: string[];
  rows: Array<{
    studentId: string;
    studentNumber: string;
    fullName: string;
    cells: Record<string, AttendanceCellValue>;
  }>;
};

export type GradesTableData = {
  cohortId: string | null;
  group: { id: string; name: string };
  subject: { id: string; name: string };
  assignmentCount: number;
  columns: string[];
  rows: Array<{
    studentId: string;
    studentNumber: string;
    fullName: string;
    cells: Record<string, number | null>;
  }>;
};
