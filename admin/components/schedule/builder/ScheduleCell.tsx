"use client";

import { useDroppable } from "@dnd-kit/core";
import { memo } from "react";

import { cn } from "@/lib/utils";

export const ScheduleCell = memo(function ScheduleCell(props: {
  droppableId: string;
  isEmpty: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: props.droppableId,
    disabled: Boolean(props.disabled),
  });

  return (
    <div
      ref={setNodeRef}
      data-droppable-id={props.droppableId}
      className={cn(
        "relative min-h-[120px] border-r border-b p-2.5",
        "bg-background",
        isOver ? "bg-accent/40" : "",
      )}
    >
      {props.isEmpty ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-2.5 rounded-sm",
            "border border-dashed",
            isOver ? "border-primary/60" : "border-muted-foreground/20",
          )}
        />
      ) : null}
      {props.children}
    </div>
  );
});
