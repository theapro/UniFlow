"use client";

import { cn } from "@/lib/utils";
import { memo } from "react";

import type { CellRef, IdName } from "./types";
import type { TimetableRow } from "./utils/timeSlots";
import { formatDateShort, formatWeekdayUTC } from "./utils/date";

export const ScheduleRow = memo(function ScheduleRow(props: {
  date: string;
  row: TimetableRow;
  groups: IdName[];
  showDateLabel: boolean;
  gridTemplateColumns: string;
  hasSelectedGroups: boolean;
  renderCell: (cell: CellRef) => React.ReactNode;
}) {
  const weekday = formatWeekdayUTC(props.date);
  const shortDate = formatDateShort(props.date);

  if (props.row.type === "break") {
    return (
      <div
        className="grid"
        style={{ gridTemplateColumns: props.gridTemplateColumns }}
      >
        <div
          className={cn(
            "border-r border-b p-2 text-xs text-muted-foreground",
            "bg-background sticky left-0 z-10",
          )}
        >
          {props.showDateLabel ? (
            <div>
              <div className="text-sm font-semibold text-foreground">
                {weekday}
              </div>
              <div className="text-xs">{shortDate}</div>
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "border-r border-b p-2 text-xs text-muted-foreground",
            "bg-background sticky left-[160px] z-10",
          )}
        >
          —
        </div>
        <div
          className={cn(
            "border-r border-b p-2 text-xs text-muted-foreground",
            "bg-background sticky left-[250px] z-10",
          )}
        >
          —
        </div>
        <div
          className={cn(
            "border-b p-2 text-sm text-muted-foreground",
            "bg-muted/20",
          )}
          style={{ gridColumn: `4 / span ${Math.max(props.groups.length, 1)}` }}
        >
          {props.row.label}
        </div>
      </div>
    );
  }

  const timeRange =
    props.row.startTime && props.row.endTime
      ? `${props.row.startTime} – ${props.row.endTime}`
      : "";

  const row = props.row;

  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: props.gridTemplateColumns }}
    >
      <div
        className={cn(
          "border-r border-b p-2 text-xs text-muted-foreground",
          "bg-background sticky left-0 z-10",
        )}
      >
        {props.showDateLabel ? (
          <div>
            <div className="text-sm font-semibold text-foreground">
              {weekday}
            </div>
            <div className="text-xs">{shortDate}</div>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "border-r border-b p-2 text-xs text-muted-foreground",
          "bg-background sticky left-[160px] z-10",
        )}
      >
        {props.row.slotNumber} Para
      </div>
      <div
        className={cn(
          "border-r border-b p-2 text-xs text-muted-foreground",
          "bg-background sticky left-[250px] z-10",
        )}
      >
        {timeRange}
      </div>

      {props.hasSelectedGroups ? (
        props.groups.map((g) => (
          <div key={g.id} className="contents">
            {props.renderCell({
              date: props.date,
              timeSlotId: row.timeSlotId,
              groupId: g.id,
            })}
          </div>
        ))
      ) : (
        <div
          className="border-b border-r p-2 text-xs text-muted-foreground"
          style={{ gridColumn: `4 / span ${Math.max(props.groups.length, 1)}` }}
        >
          Drop a Group into the header
        </div>
      )}
    </div>
  );
});
