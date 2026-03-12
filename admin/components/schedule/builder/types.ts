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
