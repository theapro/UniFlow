"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type {
  CellRef,
  DepartmentGroupAssignment,
  DepartmentGroupCategoryKey,
  IdName,
} from "./types";
import { DEPARTMENT_GROUP_ROWS } from "./types";
import type { TimetableRow } from "./utils/timeSlots";
import { deptGroupCellDroppableId } from "./utils/departmentGroupGrid";
import { sortGroupIdsForPosition } from "./utils/department";
import { ScheduleRow } from "./ScheduleRow";

export function ScheduleGrid(props: {
  dates: string[];
  timetableRows: TimetableRow[];
  allGroups: IdName[];
  groupsInOrder: IdName[];
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

  const clearDeptCell = (
    department: DepartmentGroupAssignment["department"],
    position: number,
  ) => {
    if (props.readOnly) return;
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
    const groupName = a?.groupId ? (groupsById.get(a.groupId)?.name ?? "") : "";

    return (
      <div className="border-r border-b p-2">
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
            <Badge variant="secondary" className="max-w-[140px] truncate">
              {groupName}
            </Badge>
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
                >
                  {row.label}
                </div>
                <div
                  className={cn(
                    "border-r border-b p-2",
                    "sticky left-[160px] z-30 bg-background",
                  )}
                />
                <div
                  className={cn(
                    "border-r border-b p-2",
                    "sticky left-[250px] z-30 bg-background",
                  )}
                />

                {Array.from({ length: groupCols }).map((_, position) => {
                  const isAddColumn = position === props.groupsInOrder.length;
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
                "border-r p-2 text-xs font-semibold text-foreground",
                "sticky left-0 z-30 bg-background flex items-center justify-center",
              )}
            >
              Day
            </div>
            <div
              className={cn(
                "border-r p-2 text-xs font-semibold text-foreground",
                "sticky left-[160px] z-30 bg-background flex items-center justify-center",
              )}
            >
              Para
            </div>
            <div
              className={cn(
                "border-r p-2 text-xs font-semibold text-foreground",
                "sticky left-[250px] z-30 bg-background flex items-center justify-center",
              )}
            >
              Time
            </div>

            {props.groupsInOrder.map((g) => (
              <div
                key={g.id}
                className={cn(
                  "border-r border-b p-2",
                  "bg-muted/30",
                  "select-none",
                )}
              >
                {(() => {
                  const pos = g.id.startsWith("__empty__:")
                    ? Number(g.id.split(":")[1])
                    : positionByGroupId.get(g.id);
                  const ids =
                    typeof pos === "number"
                      ? (groupsByPosition.get(pos) ?? [])
                      : [];
                  const names = ids
                    .map((id) => ({ id, name: groupsById.get(id)?.name ?? "" }))
                    .filter((x) => Boolean(x.name));

                  return names.length ? (
                    <div className="flex flex-wrap gap-1">
                      {names.map((x) => (
                        <Badge
                          key={x.id}
                          variant="secondary"
                          className="max-w-[170px] truncate"
                        >
                          {x.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="h-9" />
                  );
                })()}
              </div>
            ))}

            {Array.from({
              length: Math.max(groupCols - props.groupsInOrder.length, 0),
            }).map((_, idx) => (
              <div
                key={`__empty_header__:${idx}`}
                className="border-r border-b p-2 bg-muted/20"
              >
                {idx === 0 ? (
                  <div className="flex h-9 items-center justify-center text-muted-foreground">
                    <Plus className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="h-9" />
                )}
              </div>
            ))}
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
