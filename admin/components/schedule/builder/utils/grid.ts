import type { CellRef, LessonCardState, ScheduleGridState } from "../types";

export function cellKey(cell: CellRef) {
  return `${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`;
}

export function makeCellDroppableId(cell: CellRef) {
  return `cell:${cellKey(cell)}`;
}

export function parseCellDroppableId(id: string): CellRef | null {
  const raw = String(id);
  if (!raw.startsWith("cell:")) return null;
  const parts = raw.slice("cell:".length).split("@@");
  if (parts.length !== 3) return null;
  const [date, timeSlotId, groupId] = parts;
  if (!date || !timeSlotId || !groupId) return null;
  return { date, timeSlotId, groupId };
}

export function getLessonAtCell(grid: ScheduleGridState, cell: CellRef) {
  return grid[cell.date]?.[cell.timeSlotId]?.[cell.groupId];
}

export function setLessonAtCell(
  grid: ScheduleGridState,
  cell: CellRef,
  lesson: LessonCardState | undefined,
): ScheduleGridState {
  const next: ScheduleGridState = { ...grid };
  const day = next[cell.date] ? { ...next[cell.date] } : {};
  const slot = day[cell.timeSlotId] ? { ...day[cell.timeSlotId] } : {};

  if (lesson === undefined) {
    delete slot[cell.groupId];
  } else {
    slot[cell.groupId] = lesson;
  }

  day[cell.timeSlotId] = slot;
  next[cell.date] = day;
  return next;
}

export function isLessonComplete(lesson: LessonCardState | undefined) {
  if (!lesson) return false;
  if (lesson.kind === "saved") return true;
  return Boolean(lesson.subjectId && lesson.teacherId);
}
