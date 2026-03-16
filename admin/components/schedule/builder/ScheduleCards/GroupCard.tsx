"use client";

import { useDraggable } from "@dnd-kit/core";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";

export function GroupCard(props: {
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
          "flex items-center gap-2",
          "rounded-md border bg-card px-3 py-2 text-sm font-semibold shadow-sm",
          "select-none",
          "min-h-9",
          props.className,
        )}
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{props.name}</span>
      </div>
    );
  }

  return (
    <DraggableGroupCard
      draggableId={props.draggableId}
      dragData={props.dragData}
      name={props.name}
      className={props.className}
    />
  );
}

function DraggableGroupCard(props: {
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
        "flex items-center gap-2",
        "rounded-md border bg-card px-3 py-2 text-sm font-semibold shadow-sm",
        "select-none",
        "min-h-9",
        "cursor-grab active:cursor-grabbing",
        draggable.isDragging ? "opacity-60" : "",
        props.className,
      )}
      {...draggable.listeners}
      {...draggable.attributes}
    >
      <Users className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="truncate">{props.name}</span>
    </div>
  );
}
