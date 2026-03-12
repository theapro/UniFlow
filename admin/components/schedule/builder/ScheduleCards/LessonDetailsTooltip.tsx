"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type LessonDetailsMeta = {
  date?: string; // YYYY-MM-DD
  slotNumber?: number;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
};

function safeDate(date: string | undefined): Date | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function LessonDetailsTooltip(props: {
  disabled?: boolean;
  meta?: LessonDetailsMeta;
  subjectName?: string;
  teacherName?: string;
  roomName?: string;
  note?: string | null;
  children: React.ReactNode;
}) {
  if (props.disabled) return <>{props.children}</>;

  const d = safeDate(props.meta?.date);
  const weekday = d
    ? new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(d)
    : null;

  const whenLineParts = [
    props.meta?.date ? props.meta.date : null,
    weekday ? `(${weekday})` : null,
  ].filter(Boolean);

  const timeLineParts = [
    typeof props.meta?.slotNumber === "number"
      ? `Para ${props.meta.slotNumber}`
      : null,
    props.meta?.startTime && props.meta?.endTime
      ? `${props.meta.startTime}–${props.meta.endTime}`
      : null,
  ].filter(Boolean);

  return (
    <Tooltip delayDuration={3000}>
      <TooltipTrigger asChild>{props.children as any}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className={cn(
          "max-w-[280px]",
          "bg-popover text-popover-foreground border border-border shadow-md",
          "px-3 py-2",
        )}
      >
        <div className="space-y-2">
          <div className="space-y-0.5">
            <div className="text-[11px] font-medium text-muted-foreground">
              Lesson details
            </div>
            <div className="text-sm font-semibold leading-tight">
              {props.subjectName || "(No subject)"}
            </div>
          </div>

          {whenLineParts.length || timeLineParts.length ? (
            <div className="space-y-0.5 text-xs">
              {whenLineParts.length ? (
                <div className="text-muted-foreground">
                  {whenLineParts.join(" ")}
                </div>
              ) : null}
              {timeLineParts.length ? (
                <div className="text-muted-foreground">
                  {timeLineParts.join(" · ")}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Teacher</span>
              <span className="truncate font-medium">
                {props.teacherName || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Classroom</span>
              <span className="truncate font-medium">
                {props.roomName || "—"}
              </span>
            </div>
          </div>

          {props.note ? (
            <div className="pt-1 text-xs">
              <div className="text-muted-foreground">Note</div>
              <div className="whitespace-pre-wrap break-words">
                {props.note}
              </div>
            </div>
          ) : null}

          <div className="text-[10px] text-muted-foreground">
            Hover 3 seconds to open
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
