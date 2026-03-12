"use client";

import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext } from "react";
import type {
  DragItem,
  IdName,
  ScheduleGridState,
  Teacher,
  TimeSlot,
} from "../types";
import type { TimetableRow } from "../utils/timeSlots";

export type ScheduleBuilderCtx = {
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

  groupOrder: string[];
  setGroupOrder: Dispatch<SetStateAction<string[]>>;

  groupsInOrder: IdName[];

  grid: ScheduleGridState;
  setGrid: Dispatch<SetStateAction<ScheduleGridState>>;

  timetableRows: TimetableRow[];
  gridTemplateColumns: string;
  hasSelectedGroups: boolean;

  activeDrag: DragItem | null;
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
