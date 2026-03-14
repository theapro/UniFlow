"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { monthlyScheduleApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

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

const GROUP_COL_WIDTH_PX = 220;
const CELL_EXTRA_PX = 12;

function cellKey(cell: CellRef) {
  return `${cell.date}@@${cell.timeSlotId}@@${cell.groupId}`;
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

          const displayCover = coveredCells.get(cellKey(cell));
          const isSecondaryCovered =
            Boolean(displayCover) && displayCover!.index > 0;

          const position = groupsInOrder.findIndex(
            (g) => g.id === cell.groupId,
          );
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
          const effectiveCell = picked?.cell ?? cell;
          const lesson = picked?.lesson;
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
          const spanCount = spanGroupIds?.length ? spanGroupIds.length : 1;

          const spanLabel = (() => {
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

          const canGrowRight = (() => {
            const idx = groupsInOrder.findIndex((g) => g.id === cell.groupId);
            if (idx < 0) return false;
            if (idx + spanCount >= groupsInOrder.length) return false;
            const next = groupsInOrder[idx + spanCount];
            return Boolean(next);
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
                    "absolute inset-0 z-10 p-1.5", // p-2 -> p-1.5 (cell padding bilan bir xil)
                    "overflow-visible",
                  )}
                  style={
                    spanCount > 1
                      ? {
                          width: `calc(${spanCount * 100}% + ${(spanCount - 1) * 1}px)`,
                        }
                      : undefined
                  }
                >
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
                      readOnly ? false : spanCount > 1 ? false : undefined
                    }
                    lesson={lesson}
                    rightActions={
                      readOnly ? null : (
                        <div className="flex -mt-2 items-center gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            disabled={isProjected || spanCount <= 1}
                            onClick={() =>
                              void resizeLesson(cell, lesson, spanCount - 1)
                            }
                            aria-label="Shrink lesson width"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            disabled={isProjected || !canGrowRight}
                            onClick={() =>
                              void resizeLesson(cell, lesson, spanCount + 1)
                            }
                            aria-label="Expand lesson width"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          {lesson.kind === "saved" && !isProjected ? (
                            <LessonExpandGroupsPopover
                              cell={effectiveCell}
                              lesson={lesson}
                            />
                          ) : null}
                        </div>
                      )
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
                    groupDropdownDisabled={readOnly || spanCount > 1}
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
