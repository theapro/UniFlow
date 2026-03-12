"use client";

import { toast } from "sonner";

import { monthlyScheduleApi } from "@/lib/api";

import { ScheduleGrid } from "../ScheduleGrid";
import { ScheduleCell } from "../ScheduleCell";
import { LessonCard } from "../ScheduleCards";

import { useScheduleBuilder } from "./ScheduleBuilderContext";
import type { CellRef, DragItem, LessonCardState } from "../types";
import { getLessonAtCell, setLessonAtCell } from "../utils/grid";

function lessonDraggableId(cell: CellRef, lesson: LessonCardState) {
  if (lesson.kind === "saved") return `lesson:${lesson.scheduleId}`;
  return `lesson:draft:${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function ScheduleWorkspace() {
  const {
    month,
    year,
    datesInView,
    timetableRows,
    groupsInOrder,
    grid,
    setGrid,
    gridTemplateColumns,
    hasSelectedGroups,
    loadingMeta,
    loadingGrid,
    subjects,
    teachers,
    classrooms,
  } = useScheduleBuilder();

  const subjectsById = new Map(subjects.map((s) => [s.id, s] as const));
  const teachersById = new Map(teachers.map((t) => [t.id, t] as const));
  const classroomsById = new Map(classrooms.map((r) => [r.id, r] as const));

  const timetableByTimeSlotId = new Map(
    timetableRows
      .filter((r) => r.type === "lesson")
      .map((r) => [r.timeSlotId, r] as const),
  );

  const rightLabel =
    loadingMeta || loadingGrid ? "Loading…" : `Month: ${year}-${pad2(month)}`;

  return (
    <div className="min-w-0 space-y-3">
      <div className="text-sm text-muted-foreground">{rightLabel}</div>

      <ScheduleGrid
        dates={datesInView}
        timetableRows={timetableRows}
        groupsInOrder={groupsInOrder}
        gridTemplateColumns={gridTemplateColumns}
        hasSelectedGroups={hasSelectedGroups}
        renderCell={(cell) => {
          const lesson = getLessonAtCell(grid, cell);
          const isEmpty = !lesson;

          const row = timetableByTimeSlotId.get(cell.timeSlotId);

          const subjectName = lesson?.subjectId
            ? (subjectsById.get(lesson.subjectId)?.name ?? "")
            : "";
          const teacherName = lesson?.teacherId
            ? (teachersById.get(lesson.teacherId)?.fullName ?? "")
            : "";
          const roomName = lesson?.roomId
            ? (classroomsById.get(String(lesson.roomId))?.name ?? "")
            : "";

          return (
            <ScheduleCell
              key={`${cell.date}:${cell.timeSlotId}:${cell.groupId}`}
              droppableId={`cell:${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`}
              isEmpty={isEmpty}
            >
              {lesson ? (
                <LessonCard
                  draggableId={lessonDraggableId(cell, lesson)}
                  dragData={
                    { type: "lesson", from: cell, lesson } satisfies DragItem
                  }
                  lesson={lesson}
                  meta={{
                    date: cell.date,
                    slotNumber: row?.slotNumber,
                    startTime: row?.startTime,
                    endTime: row?.endTime,
                  }}
                  subjectName={subjectName}
                  teacherName={teacherName}
                  roomName={roomName}
                  onClearDraft={
                    lesson.kind === "draft"
                      ? () =>
                          setGrid((prev) =>
                            setLessonAtCell(prev, cell, undefined),
                          )
                      : undefined
                  }
                  onDelete={
                    lesson.kind === "saved"
                      ? async () => {
                          try {
                            await monthlyScheduleApi.remove(lesson.scheduleId);
                            setGrid((prev) =>
                              setLessonAtCell(prev, cell, undefined),
                            );
                          } catch (err: any) {
                            toast.error(
                              err?.response?.data?.message ??
                                "Failed to delete lesson",
                            );
                          }
                        }
                      : undefined
                  }
                />
              ) : null}
            </ScheduleCell>
          );
        }}
      />

      {!hasSelectedGroups ? (
        <div className="text-xs text-muted-foreground">
          Drag at least one Group into the header.
        </div>
      ) : null}
    </div>
  );
}
