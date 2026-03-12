"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ScheduleHeader(props: {
  title?: string;
  firstLessonDate: string;
  onFirstLessonDateChange: (next: string) => void;
  rightLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        props.className,
      )}
    >
      <div className="space-y-1">
        {props.title ? (
          <div className="text-sm font-semibold">{props.title}</div>
        ) : null}
        <div className="text-xs text-muted-foreground">Start date</div>
        <Input
          type="date"
          value={props.firstLessonDate}
          onChange={(e) => props.onFirstLessonDateChange(e.target.value)}
          className="w-[220px]"
        />
      </div>

      {props.rightLabel ? (
        <div className="text-sm text-muted-foreground">{props.rightLabel}</div>
      ) : null}
    </div>
  );
}
