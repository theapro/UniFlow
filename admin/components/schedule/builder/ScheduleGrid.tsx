"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type {
  CellRef,
  DepartmentGroupAssignment,
  DepartmentGroupCategoryKey,
  IdName,
  GroupMeta,
} from "./types";
import { DEPARTMENT_GROUP_ROWS } from "./types";
import type { TimetableRow } from "./utils/timeSlots";
import { deptGroupCellDroppableId } from "./utils/departmentGroupGrid";
import { sortGroupIdsForPosition } from "./utils/department";
import { ScheduleRow } from "./ScheduleRow";
import { cohortColorHsl } from "./utils/cohortColors";

export function ScheduleGrid(props: {
  dates: string[];
  timetableRows: TimetableRow[];
  allGroups: IdName[];
  groupsInOrder: GroupMeta[];
  groupCols: number;
  gridTemplateColumns: string;
  hasSelectedGroups: boolean;
  readOnly?: boolean;
  departmentGroupAssignments: DepartmentGroupAssignment[];
  onChangeDepartmentGroupAssignments: (
    next: DepartmentGroupAssignment[],
  ) => void;
  renderCell: (cell: CellRef) => React.ReactNode;
}) {
  const groupCols = props.groupCols;

  const positionByGroupId = new Map<string, number>();
  for (const a of props.departmentGroupAssignments) {
    positionByGroupId.set(a.groupId, a.position);
  }

  const groupsByPosition = new Map<number, string[]>();
  for (let pos = 0; pos < groupCols; pos += 1) {
    const ids = sortGroupIdsForPosition(props.departmentGroupAssignments, pos);
    if (ids.length) groupsByPosition.set(pos, ids);
  }

  const groupsById = new Map(props.allGroups.map((g) => [g.id, g] as const));
  const assignmentByCell = new Map<string, DepartmentGroupAssignment>();
  for (const a of props.departmentGroupAssignments) {
    assignmentByCell.set(`${a.department}@@${a.position}`, a);
  }

  const itCohortSpanForPosition = (position: number) => {
    if (position < 0 || position >= props.groupsInOrder.length) return null;
    const g = props.groupsInOrder[position];
    const isIT = String(g.parentGroup?.name ?? "") === "IT";
    const cohortCode = g.cohort?.code ? String(g.cohort.code) : "";
    if (!isIT || !cohortCode) return null;

    let start = position;
    while (start - 1 >= 0) {
      const prev = props.groupsInOrder[start - 1];
      const prevIsIT = String(prev.parentGroup?.name ?? "") === "IT";
      const prevCode = prev.cohort?.code ? String(prev.cohort.code) : "";
      if (!prevIsIT || prevCode !== cohortCode) break;
      start -= 1;
    }

    let end = position;
    while (end + 1 < props.groupsInOrder.length) {
      const next = props.groupsInOrder[end + 1];
      const nextIsIT = String(next.parentGroup?.name ?? "") === "IT";
      const nextCode = next.cohort?.code ? String(next.cohort.code) : "";
      if (!nextIsIT || nextCode !== cohortCode) break;
      end += 1;
    }

    return { start, end, cohortCode, spanCount: end - start + 1 };
  };

  const findGroupIdInSpan = (params: {
    department: DepartmentGroupAssignment["department"];
    start: number;
    end: number;
  }) => {
    for (let p = params.start; p <= params.end; p += 1) {
      const a = assignmentByCell.get(`${params.department}@@${p}`);
      if (a?.groupId) return a.groupId;
    }
    return null;
  };

  const clearDeptCell = (
    department: DepartmentGroupAssignment["department"],
    position: number,
  ) => {
    if (props.readOnly) return;

    if (department === "Employability/Cowork") {
      const span = itCohortSpanForPosition(position);
      if (span) {
        props.onChangeDepartmentGroupAssignments(
          props.departmentGroupAssignments.filter(
            (a) =>
              !(
                a.department === department &&
                a.position >= span.start &&
                a.position <= span.end
              ),
          ),
        );
        return;
      }
    }

    props.onChangeDepartmentGroupAssignments(
      props.departmentGroupAssignments.filter(
        (a) => !(a.department === department && a.position === position),
      ),
    );
  };

  function DeptDroppableCell(props2: {
    departmentKey: DepartmentGroupCategoryKey;
    departmentLabel: DepartmentGroupAssignment["department"];
    position: number;
    isAddColumn: boolean;
    colSpan?: number;
    displayGroupId?: string | null;
  }) {
    const droppableId = deptGroupCellDroppableId(
      props2.departmentKey,
      props2.position,
    );
    const droppable = useDroppable({
      id: droppableId,
      disabled: Boolean(props.readOnly),
    });

    const a = assignmentByCell.get(
      `${props2.departmentLabel}@@${props2.position}`,
    );
    const effectiveGroupId = props2.displayGroupId ?? a?.groupId ?? "";
    const groupName = effectiveGroupId
      ? (groupsById.get(effectiveGroupId)?.name ?? "")
      : "";

    const itAtPos = props.groupsInOrder[props2.position];
    const itCohortCode =
      itAtPos &&
      String(itAtPos.parentGroup?.name ?? "") === "IT" &&
      itAtPos.cohort?.code
        ? String(itAtPos.cohort.code)
        : "";
    const itCohortSortOrder =
      itAtPos &&
      typeof itAtPos.cohort?.sortOrder === "number" &&
      Number.isFinite(itAtPos.cohort.sortOrder)
        ? itAtPos.cohort.sortOrder
        : null;
    const itColor = itCohortCode
      ? cohortColorHsl({ code: itCohortCode, sortOrder: itCohortSortOrder })
      : null;

    const draggable = useDraggable({
      id: `deptgrid:${props2.departmentKey}:${props2.position}:${effectiveGroupId || "empty"}`,
      data: effectiveGroupId
        ? { type: "group", groupId: effectiveGroupId }
        : { type: "none" },
      disabled: !effectiveGroupId || Boolean(props.readOnly),
    });

    return (
      <div
        className="border-r border-b p-1"
        style={
          props2.colSpan
            ? ({ gridColumn: `span ${props2.colSpan}` } as any)
            : undefined
        }
      >
        <div
          ref={droppable.setNodeRef}
          className={cn(
            "min-h-10",
            "rounded-md border",
            "px-2 py-1",
            "flex items-center justify-between gap-2",
            groupName ? "bg-card" : "bg-muted/20",
            droppable.isOver ? "ring-1 ring-ring" : "",
          )}
        >
          {groupName ? (
            <span
              ref={draggable.setNodeRef}
              {...draggable.attributes}
              {...draggable.listeners}
              className={cn(
                "inline-flex min-w-0 flex-1",
                !props.readOnly ? "cursor-grab active:cursor-grabbing" : "",
                draggable.isDragging ? "opacity-60" : "",
              )}
            >
              <Badge
                variant="secondary"
                className={cn("w-full max-w-none truncate border-l-4")}
                style={{ borderLeftColor: itColor ?? undefined }}
              >
                {groupName}
              </Badge>
            </span>
          ) : props2.isAddColumn ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">&nbsp;</span>
          )}

          {groupName && !props.readOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                clearDeptCell(props2.departmentLabel, props2.position)
              }
              aria-label="Remove group"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <div className="h-7 w-7" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin w-full overflow-auto rounded-md border bg-background">
      <div className="min-w-max">
        <div
          className={cn(
            "sticky top-0 z-20",
            "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          )}
        >
          <div
            className={cn("grid border-b")}
            style={{ gridTemplateColumns: props.gridTemplateColumns }}
          >
            {DEPARTMENT_GROUP_ROWS.map((row) => (
              <div key={row.key} className="contents">
                <div
                  className={cn(
                    "border-r border-b p-2 text-xs font-semibold text-foreground",
                    "sticky left-0 z-30 bg-background flex items-center",
                  )}
                  style={{ gridColumn: "span 3" }}
                >
                  {row.label}
                </div>

                {row.key === "employability_cowork"
                  ? (() => {
                      const cells: React.ReactNode[] = [];
                      let position = 0;
                      while (position < groupCols) {
                        const isAddColumn =
                          position === props.groupsInOrder.length;

                        const span = itCohortSpanForPosition(position);
                        if (
                          span &&
                          span.start === position &&
                          span.spanCount > 1
                        ) {
                          const gid = findGroupIdInSpan({
                            department: row.label,
                            start: span.start,
                            end: span.end,
                          });

                          cells.push(
                            <DeptDroppableCell
                              key={`${row.key}:${position}`}
                              departmentKey={row.key}
                              departmentLabel={row.label}
                              position={position}
                              isAddColumn={false}
                              colSpan={span.spanCount}
                              displayGroupId={gid}
                            />,
                          );
                          position = span.end + 1;
                          continue;
                        }

                        cells.push(
                          <DeptDroppableCell
                            key={`${row.key}:${position}`}
                            departmentKey={row.key}
                            departmentLabel={row.label}
                            position={position}
                            isAddColumn={isAddColumn}
                          />,
                        );

                        position += 1;
                      }
                      return cells;
                    })()
                  : Array.from({ length: groupCols }).map((_, position) => {
                      const isAddColumn =
                        position === props.groupsInOrder.length;
                      return (
                        <DeptDroppableCell
                          key={`${row.key}:${position}`}
                          departmentKey={row.key}
                          departmentLabel={row.label}
                          position={position}
                          isAddColumn={isAddColumn}
                        />
                      );
                    })}
              </div>
            ))}
          </div>

          <div
            className={cn("grid border-b")}
            style={{ gridTemplateColumns: props.gridTemplateColumns }}
          >
            <div
              className={cn(
                "border-r p-1 text-xs font-semibold text-foreground",
                "sticky left-0 z-30 bg-background flex items-center justify-center",
              )}
            >
              Day
            </div>
            <div
              className={cn(
                "border-r p-1 text-xs font-semibold text-foreground",
                "sticky left-[160px] z-30 bg-background flex items-center justify-center",
              )}
            >
              Para
            </div>
            <div
              className={cn(
                "border-r p-1 text-xs font-semibold text-foreground",
                "sticky left-[250px] z-30 bg-background flex items-center justify-center",
              )}
            >
              Time
            </div>

            {(() => {
              const cells: React.ReactNode[] = [];
              let position = 0;
              const emptyCount = Math.max(
                groupCols - props.groupsInOrder.length,
                0,
              );

              while (position < groupCols) {
                const isEmptyCol = position >= props.groupsInOrder.length;
                if (isEmptyCol) {
                  const idx = position - props.groupsInOrder.length;
                  cells.push(
                    <div
                      key={`__empty_header__:${idx}`}
                      className="border-r border-b p-1 bg-muted/20"
                    >
                      {idx === 0 && emptyCount > 0 ? (
                        <div className="flex h-9 items-center justify-center text-muted-foreground">
                          <Plus className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="h-9" />
                      )}
                    </div>,
                  );
                  position += 1;
                  continue;
                }

                const span = itCohortSpanForPosition(position);
                if (span && span.start === position) {
                  const mark =
                    /\d+/.exec(span.cohortCode)?.[0] ?? span.cohortCode;
                  const it = props.groupsInOrder[position];
                  const cohortSortOrder = Number(it?.cohort?.sortOrder ?? NaN);
                  const color = cohortColorHsl({
                    code: span.cohortCode,
                    sortOrder: Number.isFinite(cohortSortOrder)
                      ? cohortSortOrder
                      : null,
                  });

                  cells.push(
                    <div
                      key={`cohort:${span.cohortCode}:${position}`}
                      className={cn(
                        "border-r border-b p-1.5",
                        "bg-muted/10",
                        "select-none relative group",
                        "flex items-center justify-center transition-all duration-200",
                      )}
                      style={{ gridColumn: `span ${span.spanCount}` } as any}
                    >
                      {color ? (
                        <div
                          className="absolute left-0 right-0 top-0 h-[3px] opacity-100 group-hover:h-[4px] transition-all"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 1px 3px ${color}30`,
                          }}
                          aria-hidden="true"
                        />
                      ) : null}

                      {/* Badge o'rniga toza Text komponenti yoki border-siz Badge */}
                      <div
                        className={cn(
                          "w-full text-center transition-transform group-hover:scale-105",
                          "font-sans", // Tizimning standart sans-serif fonti
                        )}
                      >
                        <span
                          className="text-[14px] font-extrabold tracking-tight block truncate"
                          style={{
                            color: color ?? "inherit",
                            filter: "brightness(0.9)", // Rang juda och bo'lsa, biroz to'qroq ko'rsatadi
                          }}
                        >
                          {mark}
                        </span>
                      </div>
                    </div>,
                  );
                  position = span.end + 1;
                  continue;
                }

                cells.push(
                  <div
                    key={`cohort:blank:${position}`}
                    className={cn(
                      "border-r border-b p-1",
                      "bg-muted/30",
                      "select-none relative",
                    )}
                  >
                    <div className="h-9" />
                  </div>,
                );
                position += 1;
              }

              return cells;
            })()}
          </div>
        </div>

        {props.dates.map((date) => (
          <div key={date} className="border-b">
            {props.timetableRows.map((row, idx) => (
              <ScheduleRow
                key={`${date}:${row.key}`}
                date={date}
                row={row}
                groups={props.groupsInOrder}
                groupCols={groupCols}
                showDateLabel={idx === 0}
                gridTemplateColumns={props.gridTemplateColumns}
                hasSelectedGroups={props.hasSelectedGroups}
                renderCell={props.renderCell}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
