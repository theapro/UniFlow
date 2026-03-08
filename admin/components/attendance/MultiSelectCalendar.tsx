"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function toIsoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function sortIsoDays(days: string[]) {
  return [...days]
    .map((d) => String(d).trim())
    .filter(Boolean)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function MultiSelectCalendar({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const [month, setMonth] = React.useState<Date>(() =>
    startOfMonth(new Date()),
  );

  const selectedSet = React.useMemo(
    () => new Set(sortIsoDays(value ?? [])),
    [value],
  );

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push(d);
  }

  const toggle = (d: Date) => {
    const key = toIsoDay(d);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(sortIsoDays(Array.from(next)));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="font-medium">{format(month, "MMMM yyyy")}</div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = isSameMonth(d, monthStart);
          const key = toIsoDay(d);
          const selected = selectedSet.has(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(d)}
              className={cn(
                "h-9 rounded-md border text-sm transition-colors",
                "hover:bg-muted/60",
                !inMonth && "text-muted-foreground bg-muted/30",
                selected &&
                  "bg-primary text-primary-foreground hover:bg-primary",
              )}
              aria-pressed={selected}
              title={key}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Selected: <span className="font-medium">{selectedSet.size}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
          disabled={selectedSet.size === 0}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
