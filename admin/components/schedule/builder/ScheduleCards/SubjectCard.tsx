"use client";

import { useDraggable } from "@dnd-kit/core";
import { BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export function SubjectCard(props: {
  id: string;
  name: string;
  draggableId?: string;
  dragData?: any;
  className?: string;
}) {
  if (!props.draggableId) {
    return (
      <div
        className={cn(
          "select-none",
          "inline-flex max-w-full items-center gap-2",
          "rounded-md border bg-card px-3 py-2 text-sm shadow-sm",
          "min-h-9",
          props.className,
        )}
      >
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate font-semibold">{props.name}</span>
      </div>
    );
  }

  return (
    <DraggableSubjectCard
      draggableId={props.draggableId}
      dragData={props.dragData}
      name={props.name}
      className={props.className}
    />
  );
}

function DraggableSubjectCard(props: {
  draggableId: string;
  dragData?: any;
  name: string;
  className?: string;
}) {
  const draggable = useDraggable({
    id: props.draggableId,
    data: props.dragData,
  });

  const style = draggable.transform
    ? {
        transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={draggable.setNodeRef}
      style={style}
      className={cn(
        "select-none",
        "inline-flex max-w-full items-center gap-2",
        "rounded-md border bg-card px-3 py-2 text-sm shadow-sm",
        "min-h-9",
        "cursor-grab active:cursor-grabbing",
        draggable.isDragging ? "opacity-60" : "",
        props.className,
      )}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate font-semibold">{props.name}</span>
    </div>
  );
}
