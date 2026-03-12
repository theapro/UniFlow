"use client";

import { useDroppable } from "@dnd-kit/core";
import { memo } from "react";

import { cn } from "@/lib/utils";

export const ScheduleCell = memo(function ScheduleCell(props: {
  droppableId: string;
  isEmpty: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.droppableId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-[72px] border-r border-b p-2",
        "bg-background",
        isOver ? "bg-accent/40" : "",
      )}
    >
      {props.isEmpty ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-2 rounded-sm",
            "border border-dashed",
            isOver ? "border-primary/60" : "border-muted-foreground/20",
          )}
        />
      ) : null}
      {props.children}
    </div>
  );
});
