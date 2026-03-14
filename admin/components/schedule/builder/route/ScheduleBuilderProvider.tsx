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
import { useEffect, useMemo, useRef, useState } from "react";
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
  DepartmentGroupAssignment,
  IdName,
  LessonDraft,
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
import {
  deptKeyToDepartment,
  parseDeptGroupCellDroppableId,
} from "../utils/departmentGroupGrid";
import { sortGroupIdsForPosition } from "../utils/department";
import {
  buildTimetableRows,
  getMissingTimeSlotSlotNumber,
  isMissingTimeSlotId,
} from "../utils/timeSlots";

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

type StoredLayoutV1 = {
  v: 1;
  assignments: DepartmentGroupAssignment[];
  groupOrder: Array<string | null>;
};

const MAX_POSITION_COLS = 30;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayISODateUTC() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(
    now.getUTCDate(),
  )}`;
}

function primaryCellKey(date: string, timeSlotId: string, groupId: string) {
  return `${date}@@${timeSlotId}@@${groupId}`;
}

function normalizePositions(assignments: DepartmentGroupAssignment[]) {
  const used = Array.from(new Set(assignments.map((a) => a.position)))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b);

  const positionMap = new Map<number, number>();
  used.forEach((oldPos, idx) => positionMap.set(oldPos, idx));

  const normalized: DepartmentGroupAssignment[] = assignments
    .map((a) => {
      const newPos = positionMap.get(a.position);
      if (typeof newPos !== "number") return null;
      return { ...a, position: newPos };
    })
    .filter(Boolean) as DepartmentGroupAssignment[];

  normalized.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    if (a.department !== b.department)
      return a.department.localeCompare(b.department);
    return a.groupId.localeCompare(b.groupId);
  });

  return { normalized, positionCount: used.length, positionMap };
}

function monthToFirstDayISO(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  const m = /^([0-9]{4})-([0-9]{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}

function layoutStorageKey(year: number, month: number) {
  return `uniflow.admin.scheduleBuilder.layout.v1:${year}-${pad2(month)}`;
}

function readStoredLayout(key: string): StoredLayoutV1 | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1) return null;
    const assignments = Array.isArray(parsed.assignments)
      ? (parsed.assignments as DepartmentGroupAssignment[])
      : [];
    const groupOrder = Array.isArray(parsed.groupOrder)
      ? (parsed.groupOrder as Array<string | null>)
      : [];
    return { v: 1, assignments, groupOrder };
  } catch {
    return null;
  }
}

function writeStoredLayout(key: string, value: StoredLayoutV1) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / privacy-mode write errors
  }
}

export function ScheduleBuilderProvider(props: {
  children: React.ReactNode;
  readOnly?: boolean;
  initialMonth?: string | null;
}) {
  const readOnly = Boolean(props.readOnly);
  const [firstLessonDate, setFirstLessonDate] = useState(() => {
    return monthToFirstDayISO(props.initialMonth) ?? todayISODateUTC();
  });

  useEffect(() => {
    const next = monthToFirstDayISO(props.initialMonth);
    if (!next) return;
    setFirstLessonDate((prev) => (prev === next ? prev : next));
  }, [props.initialMonth]);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);

  const [groups, setGroups] = useState<IdName[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<IdName[]>([]);
  const [classrooms, setClassrooms] = useState<IdName[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Primary group per position (index = position). Positions are dynamic.
  const [groupOrder, setGroupOrder] = useState<Array<string | null>>([]);

  // Count of *used* positions (columns with at least one group assigned).
  const [positionCount, setPositionCount] = useState(0);
  const maxPositionCount = MAX_POSITION_COLS;

  const [grid, setGrid] = useState<ScheduleGridState>({});

  const [departmentGroupAssignments, setDepartmentGroupAssignments] = useState<
    DepartmentGroupAssignment[]
  >([]);

  // UI-only: primary cell key -> covered groupIds
  const [lessonGroupSpans, setLessonGroupSpans] = useState<
    Record<string, string[]>
  >({});

  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);

  const { month, year } = useMemo(
    () => toMonthYearUTC(firstLessonDate),
    [firstLessonDate],
  );

  const layoutKey = useMemo(() => layoutStorageKey(year, month), [year, month]);
  const hasStoredLayoutRef = useRef(false);
  const [layoutHydrated, setLayoutHydrated] = useState(false);

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

  const groupsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const g of groups) map.set(g.id, g);
    return map;
  }, [groups]);

  const groupsInOrder = useMemo(() => {
    const out: IdName[] = [];
    for (let pos = 0; pos < positionCount; pos += 1) {
      const ids = sortGroupIdsForPosition(departmentGroupAssignments, pos);
      const preferred = groupOrder[pos] ?? null;
      const chosen =
        preferred && ids.includes(preferred) ? preferred : (ids[0] ?? null);
      if (!chosen) continue;
      const g = groupsById.get(chosen);
      if (g) out.push(g);
    }
    return out;
  }, [departmentGroupAssignments, groupOrder, groupsById, positionCount]);

  const hasSelectedGroups = useMemo(
    () => groupsInOrder.length > 0,
    [groupsInOrder.length],
  );

  const timetableRows = useMemo(
    () => buildTimetableRows(timeSlots),
    [timeSlots],
  );

  // Trailing "+" add column (hidden when max is reached).
  const groupCols = positionCount + (positionCount < maxPositionCount ? 1 : 0);

  const gridTemplateColumns = useMemo(() => {
    return `160px 90px 120px repeat(${groupCols}, 220px)`;
  }, [groupCols]);

  // Layout (department rows + primary group per column) is UI state and must survive refresh.
  // Persist per month/year in localStorage.
  useEffect(() => {
    hasStoredLayoutRef.current = false;
    setLayoutHydrated(false);

    const stored = readStoredLayout(layoutKey);
    hasStoredLayoutRef.current = Boolean(stored);

    if (stored) {
      setDepartmentGroupAssignments(stored.assignments);
      setGroupOrder(stored.groupOrder);
    } else {
      // New month (or cleared storage): start with empty layout.
      setDepartmentGroupAssignments([]);
      setGroupOrder([]);
    }

    // Spans are UI-only and should not leak between months.
    setLessonGroupSpans({});
    setLayoutHydrated(true);
  }, [layoutKey]);

  useEffect(() => {
    if (readOnly) return;
    if (!layoutHydrated) return;

    const isEmptyLayout =
      departmentGroupAssignments.length === 0 && groupOrder.length === 0;
    if (isEmptyLayout && !hasStoredLayoutRef.current) return;

    writeStoredLayout(layoutKey, {
      v: 1,
      assignments: departmentGroupAssignments,
      groupOrder,
    });
    hasStoredLayoutRef.current = true;
  }, [
    departmentGroupAssignments,
    groupOrder,
    layoutHydrated,
    layoutKey,
    readOnly,
  ]);

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

        // If there is no stored layout yet, derive a reasonable default from saved lessons
        // (one group per column). IMPORTANT: if a layout exists in storage, do NOT override it.
        if (!hasStoredLayoutRef.current) {
          const groupIds = Array.from(new Set(rows.map((r) => r.groupId)));
          const sortedGroupIds = groupIds
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .slice(0, maxPositionCount);

          setDepartmentGroupAssignments(
            sortedGroupIds.map((groupId, position) => ({
              department: "IT",
              position,
              groupId,
            })),
          );
          setGroupOrder(sortedGroupIds.map((id) => id));
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
  }, [month, year, maxPositionCount]);

  // Keep positions compact (no gaps) so we don't render empty columns/cells.
  useEffect(() => {
    const {
      normalized,
      positionCount: usedCount,
      positionMap,
    } = normalizePositions(departmentGroupAssignments);

    const changed =
      normalized.length !== departmentGroupAssignments.length ||
      normalized.some((a, i) => {
        const b = departmentGroupAssignments[i];
        return (
          !b ||
          a.department !== b.department ||
          a.position !== b.position ||
          a.groupId !== b.groupId
        );
      });

    if (changed) {
      setDepartmentGroupAssignments(normalized);
      return;
    }

    setPositionCount(usedCount);

    // Ensure groupOrder stays valid for each position.
    setGroupOrder((prev) => {
      const remapped: Array<string | null> = Array.from(
        { length: usedCount },
        () => null,
      );

      for (let oldPos = 0; oldPos < prev.length; oldPos += 1) {
        const newPos = positionMap.get(oldPos);
        if (typeof newPos !== "number") continue;
        remapped[newPos] = prev[oldPos] ?? null;
      }

      for (let pos = 0; pos < usedCount; pos += 1) {
        const ids = sortGroupIdsForPosition(departmentGroupAssignments, pos);
        const current = remapped[pos];
        if (current && ids.includes(current)) continue;
        remapped[pos] = ids.length ? ids[0] : null;
      }

      return remapped;
    });
  }, [departmentGroupAssignments]);

  const onDragStart = (e: DragStartEvent) => {
    if (readOnly) return;
    setActiveDrag((e.active.data.current as any) ?? null);
  };

  const onDragCancel = (_e: DragCancelEvent) => {
    setActiveDrag(null);
  };

  const onDragEnd = async (e: DragEndEvent) => {
    if (readOnly) {
      setActiveDrag(null);
      return;
    }
    const overId = e.over?.id ? String(e.over.id) : "";
    const activeId = e.active?.id ? String(e.active.id) : "";
    const activeData =
      (e.active.data.current as DragItem | undefined) ?? undefined;

    // Reordering group columns is intentionally disabled with fixed slots.

    // Assign department/group prep cell.
    if (activeData?.type === "group") {
      const deptCell = parseDeptGroupCellDroppableId(overId);
      if (deptCell) {
        const department = deptKeyToDepartment(deptCell.departmentKey);
        const position = deptCell.position;

        if (position >= maxPositionCount) {
          toast.error(`Max columns reached (${maxPositionCount})`);
          setActiveDrag(null);
          return;
        }

        setDepartmentGroupAssignments((prev) => {
          // A group should appear in only one cell total.
          const withoutGroup = prev.filter(
            (a) => a.groupId !== activeData.groupId,
          );
          // Replace the exact cell (department+position), but DO NOT clear other departments at the same position.
          const withoutCell = withoutGroup.filter(
            (a) => !(a.department === department && a.position === position),
          );
          return [
            ...withoutCell,
            { department, position, groupId: activeData.groupId },
          ];
        });

        // Only set the primary column group for this position if it's empty.
        setGroupOrder((prev) => {
          const next = [...prev];
          while (next.length <= position) next.push(null);
          if (!next[position]) next[position] = activeData.groupId;
          return next;
        });

        setActiveDrag(null);
        return;
      }
    }

    const cell = parseCellDroppableId(overId);
    if (!cell || !activeData) {
      setActiveDrag(null);
      return;
    }

    // Guard: don't allow drops into placeholder/unknown groups.
    if (!groupsById.has(cell.groupId)) {
      toast.error("Select a group in that column first");
      setActiveDrag(null);
      return;
    }

    // Guard: timetable rows must be backed by a real DB TimeSlot.
    if (isMissingTimeSlotId(cell.timeSlotId)) {
      const slotNo = getMissingTimeSlotSlotNumber(cell.timeSlotId);
      toast.error(
        slotNo
          ? `Time slots are not configured (missing slot #${slotNo}). Run backend db seed first.`
          : "Time slots are not configured. Run backend db seed first.",
      );
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
        const updatedRes = await monthlyScheduleApi.update(lesson.scheduleId, {
          date: cell.date,
          timeSlotId: cell.timeSlotId,
          groupId: cell.groupId,
        });

        const updated = updatedRes.data?.data as MonthlyScheduleRow;
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
        toast.error(err?.response?.data?.message ?? "Failed to move lesson");
      }

      setActiveDrag(null);
      return;
    }

    // 2) Dropping mini cards (subject/teacher/room) into a cell
    if (activeData.type === "mini") {
      const existing = getLessonAtCell(grid, cell);

      const spanGroupIds = lessonGroupSpans[
        primaryCellKey(cell.date, cell.timeSlotId, cell.groupId)
      ] ?? [cell.groupId];
      const spanCells = spanGroupIds.map((groupId) => ({ ...cell, groupId }));

      if (existing?.kind === "saved") {
        const patch =
          activeData.kind === "subject"
            ? { subjectId: activeData.id }
            : activeData.kind === "teacher"
              ? { teacherId: activeData.id }
              : { roomId: activeData.id };

        const prevGrid = grid;
        setGrid((prev) => {
          let next = prev;
          for (const c of spanCells) {
            const l = getLessonAtCell(prev, c);
            if (l?.kind === "saved") {
              next = setLessonAtCell(next, c, {
                ...l,
                ...(patch as any),
              });
            }
          }
          return next;
        });

        try {
          const savedTargets = spanCells
            .map((c) => ({ c, l: getLessonAtCell(prevGrid, c) }))
            .filter((x): x is { c: CellRef; l: any } => x.l?.kind === "saved")
            .map((x) => ({ c: x.c, l: x.l as any }));

          const results = await Promise.allSettled(
            savedTargets.map((x) =>
              monthlyScheduleApi
                .update(x.l.scheduleId, patch)
                .then((res) => ({ cell: x.c, row: res.data?.data as any })),
            ),
          );

          const failed = results.filter((r) => r.status === "rejected").length;

          setGrid((prev) => {
            let next = prev;
            for (let i = 0; i < results.length; i += 1) {
              const c = savedTargets[i]?.c;
              if (!c) continue;

              const r = results[i];
              if (r.status === "fulfilled") {
                const updated = r.value.row as MonthlyScheduleRow;
                next = setLessonAtCell(next, c, {
                  kind: "saved",
                  scheduleId: updated.id,
                  subjectId: updated.subjectId,
                  teacherId: updated.teacherId,
                  roomId: updated.roomId,
                  note: updated.note ?? null,
                });
              } else {
                next = setLessonAtCell(next, c, getLessonAtCell(prevGrid, c));
              }
            }
            return next;
          });

          if (failed) {
            toast.error("Some lessons failed to update");
          }
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

      setGrid((prev) => {
        let next = prev;
        for (const c of spanCells) {
          const l = getLessonAtCell(prev, c);
          const base = l?.kind === "draft" ? l : {};
          next = setLessonAtCell(next, c, {
            kind: "draft",
            ...(base as any),
            ...(nextDraft as any),
          });
        }
        return next;
      });

      // Only persist to backend when subject + teacher are known. Room is optional.
      if (!nextDraft.subjectId || !nextDraft.teacherId) {
        setActiveDrag(null);
        return;
      }

      try {
        const results = await Promise.allSettled(
          spanCells.map((c) =>
            monthlyScheduleApi
              .create({
                date: c.date,
                timeSlotId: c.timeSlotId,
                groupId: c.groupId,
                subjectId: nextDraft.subjectId!,
                teacherId: nextDraft.teacherId!,
                roomId: nextDraft.roomId ?? null,
                note: nextDraft.note ?? null,
              })
              .then((res) => ({ cell: c, row: res.data?.data as any })),
          ),
        );

        results.forEach((r, i) => {
          const c = spanCells[i];
          if (!c) return;
          if (r.status === "fulfilled") {
            const created = r.value.row as MonthlyScheduleRow;
            setGrid((prev) =>
              setLessonAtCell(prev, c, {
                kind: "saved",
                scheduleId: created.id,
                subjectId: created.subjectId,
                teacherId: created.teacherId,
                roomId: created.roomId,
                note: created.note ?? null,
              }),
            );
          } else {
            setGrid((prev) => setLessonAtCell(prev, c, undefined));
            const reason: any = r.reason;
            toast.error(
              reason?.response?.data?.message ?? "Failed to create lesson",
            );
          }
        });
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? "Failed to create lesson");
      }

      setActiveDrag(null);
      return;
    }

    setActiveDrag(null);
  };

  const ctxValue: ScheduleBuilderCtx = {
    readOnly,
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
    positionCount,
    setPositionCount,
    maxPositionCount,
    groupsInOrder,
    grid,
    setGrid,
    timetableRows,
    gridTemplateColumns,
    groupCols,
    hasSelectedGroups,
    activeDrag,
    departmentGroupAssignments,
    setDepartmentGroupAssignments,
    lessonGroupSpans,
    setLessonGroupSpans,
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
