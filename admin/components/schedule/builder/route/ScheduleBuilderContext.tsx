"use client";

import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext } from "react";
import type {
  DragItem,
  DepartmentGroupAssignment,
  IdName,
  ScheduleGridState,
  Teacher,
  TimeSlot,
} from "../types";
import type { TimetableRow } from "../utils/timeSlots";

export type ScheduleBuilderCtx = {
  readOnly: boolean;

  firstLessonDate: string;
  setFirstLessonDate: Dispatch<SetStateAction<string>>;

  month: number;
  year: number;
  datesInView: string[];

  loadingMeta: boolean;
  loadingGrid: boolean;

  groups: IdName[];
  teachers: Teacher[];
  subjects: IdName[];
  classrooms: IdName[];
  timeSlots: TimeSlot[];

  // Primary group per visible schedule column (index = workspace column position)
  groupOrder: Array<string | null>;
  setGroupOrder: Dispatch<SetStateAction<Array<string | null>>>;

  // How many group columns exist (excluding the trailing "+" add column).
  positionCount: number;
  setPositionCount: Dispatch<SetStateAction<number>>;
  maxPositionCount: number;

  groupsInOrder: IdName[];

  grid: ScheduleGridState;
  setGrid: Dispatch<SetStateAction<ScheduleGridState>>;

  timetableRows: TimetableRow[];
  gridTemplateColumns: string;
  groupCols: number;
  hasSelectedGroups: boolean;

  activeDrag: DragItem | null;

  departmentGroupAssignments: DepartmentGroupAssignment[];
  setDepartmentGroupAssignments: Dispatch<
    SetStateAction<DepartmentGroupAssignment[]>
  >;

  // UI-only: a lesson can span across multiple adjacent group columns.
  // Key: `${date}@@${timeSlotId}@@${primaryGroupId}`; Value: groupIds covered (including primary).
  lessonGroupSpans: Record<string, string[]>;
  setLessonGroupSpans: Dispatch<SetStateAction<Record<string, string[]>>>;
};

const Ctx = createContext<ScheduleBuilderCtx | null>(null);

export function useScheduleBuilder() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useScheduleBuilder must be used within ScheduleBuilderProvider",
    );
  }
  return ctx;
}

export function ScheduleBuilderContextProvider(props: {
  value: ScheduleBuilderCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={props.value}>{props.children}</Ctx.Provider>;
}
