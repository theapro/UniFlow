"use client";

import { useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";

import { monthlyScheduleApi } from "@/lib/api";

import { ScheduleGrid } from "../ScheduleGrid";
import { ScheduleCell } from "../ScheduleCell";
import { LessonCard } from "../ScheduleCards";
import { cn } from "@/lib/utils";

import { useScheduleBuilder } from "./ScheduleBuilderContext";
import type { CellRef, DragItem, LessonCardState } from "../types";
import { getLessonAtCell, setLessonAtCell } from "../utils/grid";
import {
  getMissingTimeSlotSlotNumber,
  isMissingTimeSlotId,
} from "../utils/timeSlots";

import { LessonExpandGroupsPopover } from "./LessonExpandGroupsPopover";
import { sortGroupIdsForPosition } from "../utils/department";

function lessonDraggableId(cell: CellRef, lesson: LessonCardState) {
  if (lesson.kind === "saved") return `lesson:${lesson.scheduleId}`;
  return `lesson:draft:${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const GROUP_COL_WIDTH_PX = 180;
const CELL_EXTRA_PX = 12;

function cellKey(cell: CellRef) {
  return `${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`;
}

function parseCellDroppableId(id: string): CellRef | null {
  const raw = String(id ?? "");
  if (!raw.startsWith("cell:")) return null;
  const rest = raw.slice("cell:".length);
  const [date, timeSlotId, groupId] = rest.split("@@");
  if (!date || !timeSlotId || !groupId) return null;
  return { date, timeSlotId, groupId };
}

export function ScheduleWorkspace() {
  const {
    readOnly,
    month,
    year,
    datesInView,
    timetableRows,
    groupsInOrder,
    groups,
    setGroupOrder,
    grid,
    setGrid,
    gridTemplateColumns,
    groupCols,
    hasSelectedGroups,
    loadingMeta,
    loadingGrid,
    subjects,
    teachers,
    classrooms,
    departmentGroupAssignments,
    setDepartmentGroupAssignments,
    lessonGroupSpans,
    setLessonGroupSpans,
  } = useScheduleBuilder();

  const subjectsById = new Map(subjects.map((s) => [s.id, s] as const));
  const teachersById = new Map(teachers.map((t) => [t.id, t] as const));
  const classroomsById = new Map(classrooms.map((r) => [r.id, r] as const));
  const groupsById = new Map(groups.map((g) => [g.id, g] as const));

  const timetableByTimeSlotId = new Map(
    timetableRows
      .filter((r) => r.type === "lesson")
      .map((r) => [r.timeSlotId, r] as const),
  );

  const rightLabel =
    loadingMeta || loadingGrid ? "Loading…" : `Month: ${year}-${pad2(month)}`;

  const groupIdsByPosition = useMemo(() => {
    const byPos = new Map<number, string[]>();
    for (let pos = 0; pos < groupsInOrder.length; pos += 1) {
      const ids = sortGroupIdsForPosition(departmentGroupAssignments, pos);
      if (ids.length) byPos.set(pos, ids);
    }
    return byPos;
  }, [departmentGroupAssignments, groupsInOrder.length]);

  const coveredCells = useMemo(() => {
    const map = new Map<
      string,
      { primaryKey: string; index: number; groupIds: string[] }
    >();

    for (const [primaryKey, groupIds] of Object.entries(lessonGroupSpans)) {
      const [date, timeSlotId] = primaryKey.split("@@");
      if (!date || !timeSlotId) continue;
      for (let i = 0; i < groupIds.length; i += 1) {
        const gid = groupIds[i];
        map.set(`${date}@@${timeSlotId}@@${gid}`, {
          primaryKey,
          index: i,
          groupIds,
        });
      }
    }

    return map;
  }, [lessonGroupSpans]);

  const cohortWideEmployabilityByPosition = useMemo(() => {
    const employabilityByPos = new Map<number, string>();
    for (const a of departmentGroupAssignments) {
      if (a.department !== "Employability/Cowork") continue;
      employabilityByPos.set(a.position, a.groupId);
    }

    const out: Array<{
      start: number;
      end: number;
      spanCount: number;
      cohortCode: string;
      employabilityGroupId: string;
    } | null> = Array.from({ length: groupsInOrder.length }, () => null);

    let i = 0;
    while (i < groupsInOrder.length) {
      const g = groupsInOrder[i];
      const isIT = String(g.parentGroup?.name ?? "") === "IT";
      const cohortCode = g.cohort?.code ? String(g.cohort.code) : "";
      if (!isIT || !cohortCode) {
        i += 1;
        continue;
      }

      let start = i;
      let end = i;
      while (end + 1 < groupsInOrder.length) {
        const next = groupsInOrder[end + 1];
        const nextIsIT = String(next.parentGroup?.name ?? "") === "IT";
        const nextCode = next.cohort?.code ? String(next.cohort.code) : "";
        if (!nextIsIT || nextCode !== cohortCode) break;
        end += 1;
      }

      let employabilityGroupId: string | null = null;
      for (let p = start; p <= end; p += 1) {
        const gid = employabilityByPos.get(p);
        if (gid) {
          employabilityGroupId = gid;
          break;
        }
      }

      if (employabilityGroupId) {
        const info = {
          start,
          end,
          spanCount: end - start + 1,
          cohortCode,
          employabilityGroupId,
        };
        for (let p = start; p <= end; p += 1) out[p] = info;
      }

      i = end + 1;
    }

    return out;
  }, [departmentGroupAssignments, groupsInOrder]);

  const setSpanGroupIds = (primary: CellRef, groupIds: string[]) => {
    const primaryK = cellKey(primary);
    setLessonGroupSpans((prev) => {
      const next = { ...prev };
      if (groupIds.length <= 1) {
        delete next[primaryK];
      } else {
        next[primaryK] = groupIds;
      }
      return next;
    });
  };

  const resizeLesson = async (
    primary: CellRef,
    lesson: LessonCardState,
    desiredSpan: number,
  ) => {
    if (readOnly) return;
    const idx = groupsInOrder.findIndex((g) => g.id === primary.groupId);
    if (idx < 0) return;

    const maxSpan = (() => {
      let count = 0;
      for (let i = idx; i < groupsInOrder.length; i += 1) {
        if (groupsInOrder[i]?.id?.startsWith("__empty__:")) break;
        count += 1;
      }
      return Math.max(1, count);
    })();

    const clamped = Math.max(1, Math.min(desiredSpan, maxSpan));
    const desiredGroupIds = groupsInOrder
      .slice(idx, idx + clamped)
      .map((g) => g.id);

    const currentGroupIds = lessonGroupSpans[cellKey(primary)] ?? [
      primary.groupId,
    ];
    const toAdd = desiredGroupIds.filter((id) => !currentGroupIds.includes(id));
    const toRemove = currentGroupIds.filter(
      (id) => id !== primary.groupId && !desiredGroupIds.includes(id),
    );

    // Ensure we can expand into empty slots.
    for (const gid of toAdd) {
      const c = { ...primary, groupId: gid };
      if (getLessonAtCell(grid, c)) {
        toast.error("Cannot expand into an occupied slot");
        return;
      }
    }

    // Shrink first: clear removed cells.
    if (toRemove.length) {
      const removeCells = toRemove.map((gid) => ({ ...primary, groupId: gid }));
      const removeSaved = removeCells
        .map((c) => {
          const l = getLessonAtCell(grid, c);
          return l?.kind === "saved"
            ? { id: l.scheduleId, cell: c, lesson: l }
            : null;
        })
        .filter(Boolean) as Array<{
        id: string;
        cell: CellRef;
        lesson: LessonCardState;
      }>;

      setGrid((prev) => {
        let next = prev;
        for (const c of removeCells) next = setLessonAtCell(next, c, undefined);
        return next;
      });

      if (removeSaved.length) {
        const results = await Promise.allSettled(
          removeSaved.map((x) => monthlyScheduleApi.remove(x.id)),
        );
        const failedIdx = results
          .map((r, i) => ({ r, i }))
          .filter((x) => x.r.status === "rejected")
          .map((x) => x.i);

        if (failedIdx.length) {
          // Restore any cells we failed to delete on the backend.
          setGrid((prev) => {
            let next = prev;
            for (const i of failedIdx) {
              const item = removeSaved[i];
              if (!item) continue;
              next = setLessonAtCell(next, item.cell, item.lesson);
            }
            return next;
          });

          // Keep span consistent: desired groups + any groups that couldn't be deleted.
          const failedGroupIds = failedIdx
            .map((i) => removeSaved[i]?.cell.groupId)
            .filter(Boolean) as string[];
          const remaining = Array.from(
            new Set([primary.groupId, ...desiredGroupIds, ...failedGroupIds]),
          );
          setSpanGroupIds(primary, remaining);
          toast.error("Some lessons failed to delete");
          return;
        }
      }
    }

    // Expand: add to the right.
    if (toAdd.length) {
      if (isMissingTimeSlotId(primary.timeSlotId)) {
        const slotNo = getMissingTimeSlotSlotNumber(primary.timeSlotId);
        toast.error(
          slotNo
            ? `Time slots are not configured (missing slot #${slotNo}). Run backend db seed first.`
            : "Time slots are not configured. Run backend db seed first.",
        );
        return;
      }

      const addCells = toAdd.map((gid) => ({ ...primary, groupId: gid }));

      // Optimistic placeholders.
      setGrid((prev) => {
        let next = prev;
        for (const c of addCells) {
          next = setLessonAtCell(next, c, {
            kind: "draft",
            subjectId: (lesson as any).subjectId,
            teacherId: (lesson as any).teacherId,
            roomId: (lesson as any).roomId ?? null,
            note: (lesson as any).note ?? null,
          });
        }
        return next;
      });

      if (lesson.kind === "saved") {
        const results = await Promise.allSettled(
          addCells.map((c) =>
            monthlyScheduleApi
              .create({
                date: c.date,
                timeSlotId: c.timeSlotId,
                groupId: c.groupId,
                subjectId: lesson.subjectId,
                teacherId: lesson.teacherId,
                roomId: lesson.roomId ?? null,
                note: lesson.note ?? null,
              })
              .then((res) => ({ cell: c, row: res.data?.data as any })),
          ),
        );

        const successfulGroupIds: string[] = [];
        results.forEach((r, i) => {
          const c = addCells[i];
          if (r.status === "fulfilled") {
            successfulGroupIds.push(c.groupId);
            const created = r.value.row as {
              id: string;
              subjectId: string;
              teacherId: string;
              roomId: string | null;
              note?: string | null;
            };
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
              reason?.response?.data?.message ??
                "Failed to create lesson for a group",
            );
          }
        });

        const finalGroupIds = desiredGroupIds.filter(
          (gid) => gid === primary.groupId || successfulGroupIds.includes(gid),
        );
        setSpanGroupIds(primary, finalGroupIds);
        return;
      }

      // Draft: span always succeeds.
      setSpanGroupIds(primary, desiredGroupIds);
      return;
    }

    // Only shrink/update span metadata.
    setSpanGroupIds(primary, desiredGroupIds);
  };

  const maxSpanFromIndex = (startIndex: number) => {
    let count = 0;
    for (let i = startIndex; i < groupsInOrder.length; i += 1) {
      if (groupsInOrder[i]?.id?.startsWith("__empty__:")) break;
      count += 1;
    }
    return Math.max(1, count);
  };

  const [resizeDrag, setResizeDrag] = useState<null | {
    primaryKey: string;
    primary: CellRef;
    lesson: LessonCardState;
    startIndex: number;
    previewSpan: number;
  }>(null);

  const beginResize = (
    e: ReactPointerEvent,
    params: { primary: CellRef; lesson: LessonCardState; spanCount: number },
  ) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();

    const startIndex = groupsInOrder.findIndex(
      (g) => g.id === params.primary.groupId,
    );
    if (startIndex < 0) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setResizeDrag({
      primaryKey: cellKey(params.primary),
      primary: params.primary,
      lesson: params.lesson,
      startIndex,
      previewSpan: params.spanCount,
    });
  };

  const updateResize = (e: ReactPointerEvent) => {
    if (!resizeDrag) return;
    e.preventDefault();
    e.stopPropagation();

    const elements = document.elementsFromPoint(
      e.clientX,
      e.clientY,
    ) as HTMLElement[];

    const candidateIds: string[] = [];
    for (const el of elements) {
      const cellEl = el?.closest?.(
        '[data-droppable-id^="cell:"]',
      ) as HTMLElement | null;
      const id = cellEl?.dataset?.droppableId;
      if (!id) continue;
      if (candidateIds[candidateIds.length - 1] === id) continue;
      candidateIds.push(id);
    }

    const droppableId = candidateIds[candidateIds.length - 1];
    if (!droppableId) return;
    const hovered = parseCellDroppableId(droppableId);
    if (!hovered) return;

    if (
      hovered.date !== resizeDrag.primary.date ||
      hovered.timeSlotId !== resizeDrag.primary.timeSlotId
    ) {
      return;
    }

    const hoveredIndex = groupsInOrder.findIndex(
      (g) => g.id === hovered.groupId,
    );
    if (hoveredIndex < 0) return;

    const desiredSpan = hoveredIndex - resizeDrag.startIndex + 1;
    const maxSpan = maxSpanFromIndex(resizeDrag.startIndex);
    const clamped = Math.max(1, Math.min(desiredSpan, maxSpan));

    if (clamped === resizeDrag.previewSpan) return;
    setResizeDrag((prev) => (prev ? { ...prev, previewSpan: clamped } : prev));
  };

  const endResize = async (e: ReactPointerEvent) => {
    if (!resizeDrag) return;
    e.preventDefault();
    e.stopPropagation();

    const current = resizeDrag;
    setResizeDrag(null);
    await resizeLesson(current.primary, current.lesson, current.previewSpan);
  };

  const moveLessonToGroup = async (
    from: CellRef,
    lesson: LessonCardState,
    targetGroupId: string,
    position: number,
  ) => {
    if (readOnly) return;
    if (from.groupId === targetGroupId) return;
    if ((lessonGroupSpans[cellKey(from)] ?? []).length > 1) {
      toast.error("Collapse the lesson width first");
      return;
    }

    const to: CellRef = { ...from, groupId: targetGroupId };
    if (getLessonAtCell(grid, to)) {
      toast.error("That slot is already occupied");
      return;
    }

    if (lesson.kind === "draft") {
      setGrid((prev) => {
        let next = setLessonAtCell(prev, from, undefined);
        next = setLessonAtCell(next, to, lesson);
        return next;
      });
      return;
    }

    const prevGrid = grid;
    setGrid((prev) => {
      let next = setLessonAtCell(prev, from, undefined);
      next = setLessonAtCell(next, to, lesson);
      return next;
    });

    try {
      const updatedRes = await monthlyScheduleApi.update(lesson.scheduleId, {
        groupId: to.groupId,
      });

      const updated = updatedRes.data?.data as {
        id: string;
        subjectId: string;
        teacherId: string;
        roomId: string | null;
        note?: string | null;
      };

      setGrid((prev) =>
        setLessonAtCell(prev, to, {
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
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="text-sm text-muted-foreground">{rightLabel}</div>

      <ScheduleGrid
        dates={datesInView}
        timetableRows={timetableRows}
        allGroups={groups}
        groupsInOrder={groupsInOrder}
        groupCols={groupCols}
        gridTemplateColumns={gridTemplateColumns}
        hasSelectedGroups={hasSelectedGroups}
        readOnly={readOnly}
        departmentGroupAssignments={departmentGroupAssignments}
        onChangeDepartmentGroupAssignments={setDepartmentGroupAssignments}
        renderCell={(cell) => {
          // NOTE: A visible column is a "position" (primary group), but that position can
          // have multiple groups assigned in the top department grid. To reduce confusion,
          // we also render lessons for those non-primary groups inside this same column.

          const position = groupsInOrder.findIndex(
            (g) => g.id === cell.groupId,
          );

          const cohortWide =
            position >= 0 ? cohortWideEmployabilityByPosition[position] : null;

          const cohortWideLesson = cohortWide
            ? getLessonAtCell(grid, {
                ...cell,
                groupId: cohortWide.employabilityGroupId,
              })
            : null;

          const hasCohortWide = Boolean(cohortWide && cohortWideLesson);
          const isCohortWideCovered =
            Boolean(cohortWide && cohortWideLesson) &&
            position >= 0 &&
            position !== cohortWide!.start;

          if (isCohortWideCovered) {
            return (
              <ScheduleCell
                key={`${cell.date}:${cell.timeSlotId}:${cell.groupId}`}
                droppableId={`cell:${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`}
                isEmpty={false}
                disabled={readOnly}
              />
            );
          }

          const displayCover = coveredCells.get(cellKey(cell));
          const isSecondaryCovered =
            Boolean(displayCover) && displayCover!.index > 0;
          const positionGroupIds =
            position >= 0 ? (groupIdsByPosition.get(position) ?? []) : [];

          const candidateGroupIds = [
            cell.groupId,
            ...positionGroupIds.filter((id) => id !== cell.groupId),
          ];

          const pickLessonForVisibleCell = (): {
            cell: CellRef;
            lesson: LessonCardState;
          } | null => {
            if (isSecondaryCovered) return null;

            for (const groupId of candidateGroupIds) {
              const c: CellRef = { ...cell, groupId };
              const cCover = coveredCells.get(cellKey(c));
              if (cCover && cCover.index > 0) continue;
              const l = getLessonAtCell(grid, c);
              if (l) return { cell: c, lesson: l };
            }
            return null;
          };

          const picked = pickLessonForVisibleCell();

          const cohortWideEffectiveCell =
            hasCohortWide && cohortWide
              ? {
                  ...cell,
                  groupId: cohortWide.employabilityGroupId,
                }
              : null;

          const effectiveCell = cohortWideEffectiveCell ?? picked?.cell ?? cell;
          const lesson =
            (cohortWideLesson as LessonCardState | null | undefined) ??
            picked?.lesson;
          const isProjected = effectiveCell.groupId !== cell.groupId;

          const isEmpty = !lesson && !isSecondaryCovered;

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

          const groupName = groupsById.get(effectiveCell.groupId)?.name ?? "";

          const primaryKey = cellKey(effectiveCell);
          const spanGroupIds = lessonGroupSpans[primaryKey] ?? null;
          const spanCount =
            hasCohortWide && cohortWide
              ? cohortWide.spanCount
              : spanGroupIds?.length
                ? spanGroupIds.length
                : 1;

          const liveSpanCount =
            resizeDrag && resizeDrag.primaryKey === primaryKey
              ? resizeDrag.previewSpan
              : spanCount;

          const spanLabel = (() => {
            if (hasCohortWide && cohortWide)
              return cohortWide.cohortCode
                ? `${groupName} (${cohortWide.cohortCode})`
                : groupName;
            if (!spanGroupIds || spanGroupIds.length <= 1) return groupName;
            const names = spanGroupIds
              .map((id) => groupsById.get(id)?.name ?? "")
              .filter(Boolean);
            if (names.length === 2) return `${names[0]}, ${names[1]}`;
            return `${names[0] ?? groupName} +${names.length - 1}`;
          })();

          const groupOptions = (() => {
            if (position < 0) return [];
            const ids = groupIdsByPosition.get(position) ?? [];
            return ids
              .map((id) => groupsById.get(id) ?? null)
              .filter(Boolean) as { id: string; name: string }[];
          })();

          const canResize = (() => {
            if (readOnly) return false;
            if (!lesson) return false;
            if (isProjected) return false;
            if (hasCohortWide) return false;
            const idx = groupsInOrder.findIndex(
              (g) => g.id === effectiveCell.groupId,
            );
            if (idx < 0) return false;
            return maxSpanFromIndex(idx) > 1 || liveSpanCount > 1;
          })();

          return (
            <ScheduleCell
              key={`${cell.date}:${cell.timeSlotId}:${cell.groupId}`}
              droppableId={`cell:${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`}
              isEmpty={isEmpty}
              disabled={readOnly}
            >
              {isSecondaryCovered ? null : lesson ? (
                <div
                  className={cn(
                    "absolute inset-0 z-[5] p-1.5", // keep below sticky headers/side columns
                    "overflow-visible",
                  )}
                  style={
                    liveSpanCount > 1
                      ? {
                          width: `calc(${liveSpanCount * 100}% + ${(liveSpanCount - 1) * 1}px)`,
                        }
                      : undefined
                  }
                >
                  <div className="relative h-full w-full group/lesson">
                    <LessonCard
                      draggableId={lessonDraggableId(effectiveCell, lesson)}
                      dragData={
                        {
                          type: "lesson",
                          from: effectiveCell,
                          lesson,
                        } satisfies DragItem
                      }
                      draggable={
                        readOnly
                          ? false
                          : resizeDrag && resizeDrag.primaryKey === primaryKey
                            ? false
                            : liveSpanCount > 1
                              ? false
                              : undefined
                      }
                      lesson={lesson}
                      rightActions={
                        readOnly || isProjected ? null : lesson.kind ===
                          "saved" ? (
                          <div className="flex -mt-2 items-center gap-3">
                            <LessonExpandGroupsPopover
                              cell={effectiveCell}
                              lesson={lesson}
                            />
                          </div>
                        ) : null
                      }
                      meta={{
                        date: effectiveCell.date,
                        slotNumber: row?.slotNumber,
                        startTime: row?.startTime,
                        endTime: row?.endTime,
                      }}
                      groupId={effectiveCell.groupId}
                      groupName={spanLabel}
                      groupOptions={groupOptions}
                      groupDropdownDisabled={
                        readOnly || (!hasCohortWide && liveSpanCount > 1)
                      }
                      onChangeGroupId={
                        readOnly
                          ? undefined
                          : (gid) =>
                              void moveLessonToGroup(
                                effectiveCell,
                                lesson,
                                gid,
                                position,
                              )
                      }
                      subjectName={subjectName}
                      teacherName={teacherName}
                      roomName={roomName}
                      onClearDraft={
                        readOnly
                          ? undefined
                          : lesson.kind === "draft"
                            ? () => (
                                setGrid((prev) => {
                                  const ids = spanGroupIds?.length
                                    ? spanGroupIds
                                    : [effectiveCell.groupId];
                                  let next = prev;
                                  for (const gid of ids) {
                                    next = setLessonAtCell(
                                      next,
                                      { ...effectiveCell, groupId: gid },
                                      undefined,
                                    );
                                  }
                                  return next;
                                }),
                                setSpanGroupIds(effectiveCell, [])
                              )
                            : undefined
                      }
                      onDelete={
                        readOnly
                          ? undefined
                          : lesson.kind === "saved"
                            ? async () => {
                                try {
                                  const ids = spanGroupIds?.length
                                    ? spanGroupIds
                                    : [effectiveCell.groupId];
                                  const scheduleIds: string[] = [];
                                  ids.forEach((gid) => {
                                    const l = getLessonAtCell(grid, {
                                      ...effectiveCell,
                                      groupId: gid,
                                    });
                                    if (l?.kind === "saved")
                                      scheduleIds.push(l.scheduleId);
                                  });

                                  const prevGrid = grid;
                                  const prevSpan = spanGroupIds?.length
                                    ? [...spanGroupIds]
                                    : [];

                                  setGrid((prev) => {
                                    let next = prev;
                                    for (const gid of ids) {
                                      next = setLessonAtCell(
                                        next,
                                        { ...effectiveCell, groupId: gid },
                                        undefined,
                                      );
                                    }
                                    return next;
                                  });

                                  if (scheduleIds.length) {
                                    const results = await Promise.allSettled(
                                      scheduleIds.map((id) =>
                                        monthlyScheduleApi.remove(id),
                                      ),
                                    );

                                    const failed = results.some(
                                      (r) => r.status === "rejected",
                                    );
                                    if (failed) {
                                      setGrid(prevGrid);
                                      setSpanGroupIds(effectiveCell, prevSpan);
                                      toast.error(
                                        "Some lessons failed to delete",
                                      );
                                      return;
                                    }
                                  }

                                  setSpanGroupIds(effectiveCell, []);
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

                    {canResize ? (
                      <div
                        className={cn(
                          "absolute inset-y-0 right-0 w-2",
                          "cursor-ew-resize",
                          "opacity-0 group-hover/lesson:opacity-100",
                        )}
                        onPointerDown={(e) =>
                          beginResize(e, {
                            primary: effectiveCell,
                            lesson,
                            spanCount,
                          })
                        }
                        onPointerMove={updateResize}
                        onPointerUp={(e) => void endResize(e)}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </ScheduleCell>
          );
        }}
      />

      {!hasSelectedGroups ? (
        <div className="text-xs text-muted-foreground">
          Drag at least one Group into the category rows above.
        </div>
      ) : null}
    </div>
  );
}
