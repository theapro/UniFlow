"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Trash2, X } from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LessonCardState } from "../types";
import {
  LessonDetailsTooltip,
  type LessonDetailsMeta,
} from "./LessonDetailsTooltip";

export const LessonCard = memo(
  function LessonCard(props: {
    draggableId?: string;
    dragData?: any;
    draggable?: boolean;
    lesson: LessonCardState;
    subjectName?: string;
    teacherName?: string;
    roomName?: string;
    meta?: LessonDetailsMeta;
    onDelete?: () => void;
    onClearDraft?: () => void;
    isOverlay?: boolean;
  }) {
    const isDraggable = props.draggable ?? true;
    const draggable =
      isDraggable && props.draggableId
        ? useDraggable({
            id: props.draggableId,
            data: props.dragData,
          })
        : null;

    const style = draggable?.transform
      ? {
          transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
        }
      : undefined;

    const showDelete = props.lesson.kind === "saved" && props.onDelete;
    const showClear = props.lesson.kind === "draft" && props.onClearDraft;

    return (
      <>
        <LessonDetailsTooltip
          disabled={Boolean(props.isOverlay) || Boolean(draggable?.isDragging)}
          meta={props.meta}
          subjectName={props.subjectName}
          teacherName={props.teacherName}
          roomName={props.roomName}
          note={props.lesson.note}
        >
          <div
            ref={draggable?.setNodeRef}
            style={props.isOverlay ? undefined : style}
            className={cn(
              "relative rounded-md border bg-card",
              "px-2.5 py-2",
              "min-h-[72px]",
              props.isOverlay ? "shadow-lg" : "shadow-sm",
              draggable?.isDragging && !props.isOverlay ? "opacity-40" : "",
            )}
          >
            <div className="flex items-start gap-2">
              {isDraggable && draggable ? (
                <button
                  type="button"
                  className={cn(
                    "mt-0.5 inline-flex h-7 w-7 items-center justify-center",
                    "rounded-md hover:bg-muted",
                    "cursor-grab active:cursor-grabbing",
                  )}
                  {...draggable.listeners}
                  {...draggable.attributes}
                  aria-label="Drag lesson"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : (
                <div className="mt-0.5 h-7 w-7" />
              )}

              <div className="min-w-0 flex-1 space-y-1">
                <div className="truncate text-sm font-semibold">
                  {props.subjectName ||
                    (props.lesson.kind === "draft" ? "Drop subject" : "")}
                </div>
                <div className="flex flex-wrap gap-1">
                  <div className="rounded-md border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {props.teacherName ||
                      (props.lesson.kind === "draft" ? "Teacher" : "")}
                  </div>
                  <div className="rounded-md border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                    {props.roomName ||
                      (props.lesson.kind === "draft" ? "Classroom" : "")}
                  </div>
                </div>
              </div>

              {showDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={props.onDelete}
                  aria-label="Delete lesson"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}

              {showClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={props.onClearDraft}
                  aria-label="Clear draft"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </LessonDetailsTooltip>
      </>
    );
  },
  (prev, next) => {
    return (
      prev.lesson === next.lesson &&
      prev.subjectName === next.subjectName &&
      prev.teacherName === next.teacherName &&
      prev.roomName === next.roomName &&
      prev.draggableId === next.draggableId &&
      prev.draggable === next.draggable &&
      prev.isOverlay === next.isOverlay
    );
  },
);
