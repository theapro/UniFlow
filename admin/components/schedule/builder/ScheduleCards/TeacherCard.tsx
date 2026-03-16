"use client";

import { useDraggable } from "@dnd-kit/core";
import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

export function TeacherCard(props: {
  id: string;
  fullName: string;
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
        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate font-semibold">{props.fullName}</span>
      </div>
    );
  }

  return (
    <DraggableTeacherCard
      draggableId={props.draggableId}
      dragData={props.dragData}
      fullName={props.fullName}
      className={props.className}
    />
  );
}

function DraggableTeacherCard(props: {
  draggableId: string;
  dragData?: any;
  fullName: string;
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
      <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate font-semibold">{props.fullName}</span>
    </div>
  );
}
