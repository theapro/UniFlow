"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";

import type { CellRef, IdName } from "./types";
import type { TimetableRow } from "./utils/timeSlots";
import { GroupCard } from "./ScheduleCards";
import { ScheduleRow } from "./ScheduleRow";

function SortableGroupHeader(props: { group: IdName }) {
  const sortable = useSortable({
    id: `group:${props.group.id}`,
    data: { type: "group", groupId: props.group.id },
  });

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "border-r border-b p-2",
        "bg-muted/30",
        "select-none",
        sortable.isDragging ? "opacity-60" : "",
      )}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <GroupCard
        id={props.group.id}
        name={props.group.name}
        className="w-full justify-start"
      />
    </div>
  );
}

export function ScheduleGrid(props: {
  dates: string[];
  timetableRows: TimetableRow[];
  groupsInOrder: IdName[];
  gridTemplateColumns: string;
  hasSelectedGroups: boolean;
  renderCell: (cell: CellRef) => React.ReactNode;
}) {
  const groupIds = props.groupsInOrder.map((g) => `group:${g.id}`);
  const groupsDrop = useDroppable({ id: "groups-dropzone" });

  return (
    <div className="scrollbar-thin w-full overflow-auto rounded-md border bg-background">
      <div className="min-w-max">
        <div
          className={cn("grid border-b", "sticky top-0 z-20", "bg-muted/30")}
          style={{ gridTemplateColumns: props.gridTemplateColumns }}
        >
          <div
            className={cn(
              "border-r p-2 text-sm font-semibold",
              "sticky left-0 z-30 bg-muted/30",
            )}
          >
            DAY
          </div>
          <div
            className={cn(
              "border-r p-2 text-xs font-medium",
              "sticky left-[160px] z-30 bg-muted/30",
            )}
          >
            Para
          </div>
          <div
            className={cn(
              "border-r p-2 text-xs font-medium",
              "sticky left-[250px] z-30 bg-muted/30",
            )}
          >
            Time
          </div>

          {props.hasSelectedGroups ? (
            <SortableContext
              items={groupIds}
              strategy={horizontalListSortingStrategy}
            >
              {props.groupsInOrder.map((g) => (
                <SortableGroupHeader key={g.id} group={g} />
              ))}
            </SortableContext>
          ) : (
            <div
              ref={groupsDrop.setNodeRef}
              className={cn(
                "border-b p-2 text-xs font-medium",
                "text-muted-foreground",
                "bg-muted/20",
                groupsDrop.isOver ? "bg-accent/40" : "",
              )}
            >
              Drop groups here
            </div>
          )}
        </div>

        {props.dates.map((date) => (
          <div key={date} className="border-b">
            {props.timetableRows.map((row, idx) => (
              <ScheduleRow
                key={`${date}:${row.key}`}
                date={date}
                row={row}
                groups={props.groupsInOrder}
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
