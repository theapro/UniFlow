"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  groupsApi,
  monthlyScheduleApi,
  roomsApi,
  subjectsApi,
  teachersApi,
  timeSlotsApi,
} from "@/lib/api";

import {
  ClassroomCard,
  LessonCard,
  SubjectCard,
  TeacherCard,
} from "../ScheduleCards";
import type {
  CellRef,
  DragItem,
  IdName,
  LessonCardState,
  ScheduleGridState,
  Teacher,
  TimeSlot,
} from "../types";
import {
  generateDatesForMonthFromStartDateUTC,
  toMonthYearUTC,
} from "../utils/date";
import {
  getLessonAtCell,
  parseCellDroppableId,
  setLessonAtCell,
} from "../utils/grid";
import { buildTimetableRows } from "../utils/timeSlots";

import {
  ScheduleBuilderContextProvider,
  type ScheduleBuilderCtx,
} from "./ScheduleBuilderContext";

type MonthlyScheduleRow = {
  id: string;
  date: string; // YYYY-MM-DD
  weekday: string;
  timeSlotId: string;
  groupId: string;
  teacherId: string;
  subjectId: string;
  roomId: string | null;
  note?: string | null;
  timeSlot?: TimeSlot;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISODateUTC() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(
    now.getUTCDate(),
  )}`;
}

export function ScheduleBuilderProvider(props: { children: React.ReactNode }) {
  const [firstLessonDate, setFirstLessonDate] = useState(todayISODateUTC);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const [groups, setGroups] = useState<IdName[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<IdName[]>([]);
  const [classrooms, setClassrooms] = useState<IdName[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Selected groups (columns) must start empty per spec.
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [grid, setGrid] = useState<ScheduleGridState>({});

  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);

  const { month, year } = useMemo(
    () => toMonthYearUTC(firstLessonDate),
    [firstLessonDate],
  );

  const datesInView = useMemo(
    () => generateDatesForMonthFromStartDateUTC(firstLessonDate),
    [firstLessonDate],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const subjectsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const s of subjects) map.set(s.id, s);
    return map;
  }, [subjects]);

  const teachersById = useMemo(() => {
    const map = new Map<string, Teacher>();
    for (const t of teachers) map.set(t.id, t);
    return map;
  }, [teachers]);

  const classroomsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const r of classrooms) map.set(r.id, r);
    return map;
  }, [classrooms]);

  const groupsInOrder = useMemo(() => {
    const byId = new Map(groups.map((g) => [g.id, g] as const));
    return groupOrder.map((id) => byId.get(id)).filter(Boolean) as IdName[];
  }, [groups, groupOrder]);

  const hasSelectedGroups = groupsInOrder.length > 0;

  const timetableRows = useMemo(
    () => buildTimetableRows(timeSlots),
    [timeSlots],
  );

  const gridTemplateColumns = useMemo(() => {
    // When no selected groups, keep one placeholder column visible.
    const groupCols = Math.max(groupsInOrder.length, 1);
    return `160px 90px 120px repeat(${groupCols}, 220px)`;
  }, [groupsInOrder.length]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingMeta(true);
      try {
        const [gRes, tRes, sRes, rRes, tsRes] = await Promise.all([
          groupsApi.list({ take: 500 }),
          teachersApi.list({ take: 500 }),
          subjectsApi.list({ take: 500 }),
          roomsApi.list({ take: 500 }),
          timeSlotsApi.list(),
        ]);

        if (!active) return;
        setGroups((gRes.data?.data ?? []) as IdName[]);
        setTeachers((tRes.data?.data ?? []) as Teacher[]);
        setSubjects((sRes.data?.data ?? []) as IdName[]);
        setClassrooms((rRes.data?.data ?? []) as IdName[]);
        setTimeSlots((tsRes.data?.data ?? []) as TimeSlot[]);
      } catch (err: any) {
        if (!active) return;
        toast.error(
          err?.response?.data?.message ?? "Failed to load schedule data",
        );
      } finally {
        if (active) setLoadingMeta(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingGrid(true);
      try {
        const res = await monthlyScheduleApi.list({ month, year });
        if (!active) return;

        const rows = (res.data?.data ?? []) as MonthlyScheduleRow[];
        let nextGrid: ScheduleGridState = {};
        for (const r of rows) {
          nextGrid = setLessonAtCell(
            nextGrid,
            { date: r.date, timeSlotId: r.timeSlotId, groupId: r.groupId },
            {
              kind: "saved",
              scheduleId: r.id,
              subjectId: r.subjectId,
              teacherId: r.teacherId,
              roomId: r.roomId,
              note: r.note ?? null,
            },
          );
        }

        setGrid(nextGrid);
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message ?? "Failed to load schedule");
        setGrid({});
      } finally {
        if (active) setLoadingGrid(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [month, year]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveDrag((e.active.data.current as any) ?? null);
  };

  const onDragCancel = (_e: DragCancelEvent) => {
    setActiveDrag(null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const overId = e.over?.id ? String(e.over.id) : "";
    const activeId = e.active?.id ? String(e.active.id) : "";
    const activeData =
      (e.active.data.current as DragItem | undefined) ?? undefined;

    // Add group columns only when the group is dragged from the sidebar.
    if (activeData?.type === "group" && activeId.startsWith("sidebar:group:")) {
      const groupId = activeData.groupId;
      if (overId === "groups-dropzone") {
        setGroupOrder((prev) =>
          prev.includes(groupId) ? prev : [...prev, groupId],
        );
        setActiveDrag(null);
        return;
      }

      if (overId.startsWith("group:")) {
        const beforeId = overId.slice("group:".length);
        setGroupOrder((prev) => {
          if (prev.includes(groupId)) return prev;
          const idx = prev.indexOf(beforeId);
          if (idx === -1) return [...prev, groupId];
          const next = [...prev];
          next.splice(idx, 0, groupId);
          return next;
        });
        setActiveDrag(null);
        return;
      }
    }

    // Reorder selected group columns.
    if (activeId.startsWith("group:") && overId.startsWith("group:")) {
      const fromId = activeId.slice("group:".length);
      const toId = overId.slice("group:".length);
      if (fromId && toId && fromId !== toId) {
        setGroupOrder((prev) => {
          const oldIndex = prev.indexOf(fromId);
          const newIndex = prev.indexOf(toId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
      setActiveDrag(null);
      return;
    }

    const cell = parseCellDroppableId(overId);
    if (!cell || !activeData) {
      setActiveDrag(null);
      return;
    }

    // Guard: if group is not selected, ignore.
    if (groupOrder.length && !groupOrder.includes(cell.groupId)) {
      setActiveDrag(null);
      return;
    }

    // 1) Moving a whole LessonCard between cells
    if (activeData.type === "lesson") {
      const fromCell = activeData.from;
      const lesson = activeData.lesson;

      if (
        fromCell.date === cell.date &&
        fromCell.timeSlotId === cell.timeSlotId &&
        fromCell.groupId === cell.groupId
      ) {
        setActiveDrag(null);
        return;
      }

      const targetHasLesson = Boolean(getLessonAtCell(grid, cell));
      if (targetHasLesson) {
        toast.error("That slot is already occupied");
        setActiveDrag(null);
        return;
      }

      if (lesson.kind === "draft") {
        setGrid((prev) => {
          let next = setLessonAtCell(prev, fromCell, undefined);
          next = setLessonAtCell(next, cell, lesson);
          return next;
        });
        setActiveDrag(null);
        return;
      }

      const prevGrid = grid;
      // Optimistic UI move
      setGrid((prev) => {
        let next = setLessonAtCell(prev, fromCell, undefined);
        next = setLessonAtCell(next, cell, lesson);
        return next;
      });

      try {
        const createdRes = await monthlyScheduleApi.create({
          date: cell.date,
          timeSlotId: cell.timeSlotId,
          groupId: cell.groupId,
          teacherId: lesson.teacherId,
          subjectId: lesson.subjectId,
          roomId: lesson.roomId ?? null,
          note: lesson.note ?? null,
        });

        const created = createdRes.data?.data as MonthlyScheduleRow;

        try {
          await monthlyScheduleApi.remove(lesson.scheduleId);
        } catch (removeErr: any) {
          // Keep both visible if we couldn't delete old
          setGrid((prev) =>
            setLessonAtCell(prev, fromCell, {
              kind: "saved",
              scheduleId: lesson.scheduleId,
              subjectId: lesson.subjectId,
              teacherId: lesson.teacherId,
              roomId: lesson.roomId ?? null,
              note: lesson.note ?? null,
            }),
          );
          toast.error(
            removeErr?.response?.data?.message ??
              "Moved, but failed to delete old entry",
          );
        }

        setGrid((prev) =>
          setLessonAtCell(prev, cell, {
            kind: "saved",
            scheduleId: created.id,
            subjectId: created.subjectId,
            teacherId: created.teacherId,
            roomId: created.roomId,
            note: created.note ?? null,
          }),
        );
      } catch (err: any) {
        setGrid(prevGrid);
        toast.error(err?.response?.data?.message ?? "Failed to move lesson");
      }

      setActiveDrag(null);
      return;
    }

    // 2) Dropping mini cards (subject/teacher/room) into a cell
    if (activeData.type === "mini") {
      const existing = getLessonAtCell(grid, cell);

      if (existing?.kind === "saved") {
        const patch =
          activeData.kind === "subject"
            ? { subjectId: activeData.id }
            : activeData.kind === "teacher"
              ? { teacherId: activeData.id }
              : { roomId: activeData.id };

        const prevGrid = grid;
        setGrid((prev) =>
          setLessonAtCell(prev, cell, {
            ...existing,
            ...(patch as any),
          }),
        );

        try {
          const res = await monthlyScheduleApi.update(
            existing.scheduleId,
            patch,
          );
          const updated = res.data?.data as MonthlyScheduleRow;
          setGrid((prev) =>
            setLessonAtCell(prev, cell, {
              kind: "saved",
              scheduleId: updated.id,
              subjectId: updated.subjectId,
              teacherId: updated.teacherId,
              roomId: updated.roomId,
              note: updated.note ?? null,
            }),
          );
        } catch (err: any) {
          setGrid(prevGrid);
          toast.error(
            err?.response?.data?.message ?? "Failed to update lesson",
          );
        }

        setActiveDrag(null);
        return;
      }

      // Create/update draft
      const nextDraft: LessonCardState = {
        kind: "draft",
        ...(existing?.kind === "draft" ? existing : {}),
        ...(activeData.kind === "subject" ? { subjectId: activeData.id } : {}),
        ...(activeData.kind === "teacher" ? { teacherId: activeData.id } : {}),
        ...(activeData.kind === "room" ? { roomId: activeData.id } : {}),
      };

      setGrid((prev) => setLessonAtCell(prev, cell, nextDraft));

      if (!nextDraft.subjectId || !nextDraft.teacherId || !nextDraft.roomId) {
        setActiveDrag(null);
        return;
      }

      try {
        const res = await monthlyScheduleApi.create({
          date: cell.date,
          timeSlotId: cell.timeSlotId,
          groupId: cell.groupId,
          subjectId: nextDraft.subjectId,
          teacherId: nextDraft.teacherId,
          roomId: nextDraft.roomId ?? null,
        });

        const created = res.data?.data as MonthlyScheduleRow;
        setGrid((prev) =>
          setLessonAtCell(prev, cell, {
            kind: "saved",
            scheduleId: created.id,
            subjectId: created.subjectId,
            teacherId: created.teacherId,
            roomId: created.roomId,
            note: created.note ?? null,
          }),
        );
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? "Failed to create lesson");
      }

      setActiveDrag(null);
      return;
    }

    setActiveDrag(null);
  };

  const ctxValue: ScheduleBuilderCtx = {
    firstLessonDate,
    setFirstLessonDate,
    month,
    year,
    datesInView,
    loadingMeta,
    loadingGrid,
    groups,
    teachers,
    subjects,
    classrooms,
    timeSlots,
    groupOrder,
    setGroupOrder,
    groupsInOrder,
    grid,
    setGrid,
    timetableRows,
    gridTemplateColumns,
    hasSelectedGroups,
    activeDrag,
  };

  return (
    <ScheduleBuilderContextProvider value={ctxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragCancel={onDragCancel}
        onDragEnd={onDragEnd}
      >
        {props.children}

        <DragOverlay>
          {activeDrag?.type === "mini" ? (
            activeDrag.kind === "subject" ? (
              <SubjectCard
                id={activeDrag.id}
                name={subjectsById.get(activeDrag.id)?.name ?? ""}
              />
            ) : activeDrag.kind === "teacher" ? (
              <TeacherCard
                id={activeDrag.id}
                fullName={teachersById.get(activeDrag.id)?.fullName ?? ""}
              />
            ) : (
              <ClassroomCard
                id={activeDrag.id}
                name={classroomsById.get(activeDrag.id)?.name ?? ""}
              />
            )
          ) : activeDrag?.type === "lesson" ? (
            <LessonCard
              draggable={false}
              lesson={activeDrag.lesson}
              subjectName={
                activeDrag.lesson.subjectId
                  ? (subjectsById.get(activeDrag.lesson.subjectId)?.name ?? "")
                  : ""
              }
              teacherName={
                activeDrag.lesson.teacherId
                  ? (teachersById.get(activeDrag.lesson.teacherId)?.fullName ??
                    "")
                  : ""
              }
              roomName={
                activeDrag.lesson.roomId
                  ? (classroomsById.get(String(activeDrag.lesson.roomId))
                      ?.name ?? "")
                  : ""
              }
              isOverlay
            />
          ) : activeDrag?.type === "group" ? (
            <div className="rounded-sm border bg-background px-2 py-1 text-xs font-medium">
              {groups.find((g) => g.id === activeDrag.groupId)?.name ?? ""}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </ScheduleBuilderContextProvider>
  );
}
