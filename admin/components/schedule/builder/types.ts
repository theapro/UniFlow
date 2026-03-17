export type IdName = { id: string; name: string };

export type CohortMeta = {
  id?: string;
  code?: string;
  sortOrder?: number;
  year?: number | null;
};

export type ParentGroupMeta = { id?: string; name?: string };

export type SubjectMeta = IdName & {
  code?: string | null;
  parentGroup?: ParentGroupMeta | null;
  cohort?: CohortMeta | null;
};

export type GroupMeta = IdName & {
  parentGroup?: ParentGroupMeta | null;
  cohort?: CohortMeta | null;
};

export type Teacher = { id: string; fullName: string };

export type TimeSlot = {
  id: string;
  slotNumber: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isBreak: boolean;
};

export type CellRef = {
  date: string; // YYYY-MM-DD
  timeSlotId: string;
  groupId: string;
};

export type LessonDraft = {
  subjectId?: string;
  teacherId?: string;
  roomId?: string | null;
  note?: string | null;
};

export type LessonSaved = {
  scheduleId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string | null;
  note?: string | null;
};

export type LessonCardState =
  | ({ kind: "draft" } & LessonDraft)
  | ({ kind: "saved" } & LessonSaved);

export type ScheduleGridState = Record<
  string,
  | Record<string, Record<string, LessonCardState | undefined> | undefined>
  | undefined
>;

export type DragItem =
  | {
      type: "mini";
      kind: "subject" | "teacher" | "room";
      id: string;
    }
  | {
      type: "lesson";
      from: CellRef;
      lesson: LessonCardState;
    }
  | {
      type: "group";
      groupId: string;
    };

export type DepartmentGroupCategoryKey =
  | "it"
  | "japanese"
  | "partner_university"
  | "employability_cowork"
  | "language_university";

export type DepartmentGroupDepartment =
  | "IT"
  | "Japanese"
  | "Partner University"
  | "Employability/Cowork"
  | "Language University";

export const DEPARTMENT_GROUP_ROWS: Array<{
  key: DepartmentGroupCategoryKey;
  label: DepartmentGroupDepartment;
}> = [
  { key: "it", label: "IT" },
  { key: "japanese", label: "Japanese" },
  { key: "partner_university", label: "Partner University" },
  { key: "employability_cowork", label: "Employability/Cowork" },
  { key: "language_university", label: "Language University" },
];

export type DepartmentGroupAssignment = {
  department: DepartmentGroupDepartment;
  position: number;
  groupId: string;
};
