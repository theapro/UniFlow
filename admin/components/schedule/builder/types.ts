export type IdName = { id: string; name: string };

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
  | "language_university";

export type DepartmentGroupDepartment =
  | "IT"
  | "Japanese"
  | "Partner University"
  | "Language University";

export const DEPARTMENT_GROUP_ROWS: Array<{
  key: DepartmentGroupCategoryKey;
  label: DepartmentGroupDepartment;
}> = [
  { key: "it", label: "IT" },
  { key: "japanese", label: "Japanese" },
  { key: "partner_university", label: "Partner University" },
  { key: "language_university", label: "Language University" },
];

export type DepartmentGroupAssignment = {
  department: DepartmentGroupDepartment;
  position: number;
  groupId: string;
};
