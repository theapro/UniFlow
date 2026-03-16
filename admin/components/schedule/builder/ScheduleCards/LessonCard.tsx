"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  ChevronDown,
  GripVertical,
  Trash2,
  X,
  User,
  MapPin,
  Users,
} from "lucide-react";
import { memo, type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { IdName, LessonCardState } from "../types";

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

    groupId?: string;
    groupName?: string;
    groupOptions?: IdName[];
    onChangeGroupId?: (groupId: string) => void;
    groupDropdownDisabled?: boolean;

    subjectName?: string;
    teacherName?: string;
    roomName?: string;

    meta?: LessonDetailsMeta;

    onDelete?: () => void;
    onClearDraft?: () => void;

    isOverlay?: boolean;
    rightActions?: ReactNode;
  }) {
    const isDraggable = props.draggable ?? true;
    const isDraft = props.lesson.kind === "draft";

    const canDrag = Boolean(isDraggable && props.draggableId);
    const fallbackId = useId();
    const dragId = props.draggableId ?? `lesson:${fallbackId}`;
    const draggable = useDraggable({
      id: dragId,
      data: props.dragData,
      disabled: !canDrag,
    });

    const style = draggable?.transform
      ? {
          transform: `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)`,
        }
      : undefined;

    const showDelete = props.lesson.kind === "saved" && props.onDelete;
    const showClear = isDraft && props.onClearDraft;

    return (
      <LessonDetailsTooltip
        disabled={Boolean(props.isOverlay) || (canDrag && draggable.isDragging)}
        meta={props.meta}
        groupName={props.groupName}
        subjectName={props.subjectName}
        teacherName={props.teacherName}
        roomName={props.roomName}
        note={props.lesson.note}
      >
        <div
          ref={draggable.setNodeRef}
          style={props.isOverlay ? undefined : style}
          className={cn(
            "group relative flex flex-col rounded-lg border p-2",
            "bg-muted/40 text-foreground",
            "hover:bg-muted/50",
            "select-none h-full w-full",

            isDraft && "border-l-[4px] border-l-amber-500",

            props.isOverlay && "shadow-2xl ring-2 ring-primary scale-[1.02]",
            canDrag && draggable.isDragging && !props.isOverlay && "opacity-30",
          )}
        >
          {/* HEADER */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4
                className={cn(
                  "text-[11px] font-semibold leading-tight truncate",
                  !props.subjectName && "text-muted-foreground italic",
                )}
              >
                {props.subjectName || (isDraft ? "Fan tanlanmagan" : "—")}
              </h4>

              {/* GROUP */}
              {props.groupName && (
                <div className="mt-1">
                  {props.groupId &&
                  props.groupOptions &&
                  !props.groupDropdownDisabled ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-[2px] text-[10px] font-medium hover:bg-muted/80">
                          <Users className="h-3 w-3" />
                          <span className="truncate max-w-[90px]">
                            {props.groupName}
                          </span>
                          <ChevronDown className="h-3 w-3 opacity-70" />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="start" className="w-44">
                        {props.groupOptions.map((g) => (
                          <DropdownMenuItem
                            key={g.id}
                            onSelect={() => props.onChangeGroupId?.(g.id)}
                          >
                            {g.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-[2px] text-[10px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="truncate max-w-[110px]">
                        {props.groupName}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* DRAG HANDLE */}
            <div className="flex items-center gap-1">
              {props.rightActions}

              {canDrag && (
                <div
                  {...draggable.listeners}
                  {...draggable.attributes}
                  className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>

          {/* META INFO */}
          <div className="mt-1 space-y-1 text-[10px]">
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <User className="h-3.5 w-3.5 opacity-70 shrink-0" />
              {props.teacherName || (isDraft ? "O‘qituvchi tanlanmagan" : "—")}
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <MapPin className="h-3.5 w-3.5 opacity-70 shrink-0" />
              {props.roomName || (isDraft ? "Xona belgilanmagan" : "—")}
            </div>
          </div>

          {/* FLOATING ACTIONS */}
          <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
            {showDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="h-6 w-6 rounded-full shadow-md border border-background"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onDelete?.();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}

            {showClear && (
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full bg-background border-amber-200 shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  props.onClearDraft?.();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </LessonDetailsTooltip>
    );
  },

  (prev, next) => {
    return (
      prev.lesson === next.lesson &&
      prev.groupId === next.groupId &&
      prev.groupName === next.groupName &&
      prev.groupOptions === next.groupOptions &&
      prev.subjectName === next.subjectName &&
      prev.teacherName === next.teacherName &&
      prev.roomName === next.roomName &&
      prev.draggableId === next.draggableId &&
      prev.isOverlay === next.isOverlay &&
      prev.rightActions === next.rightActions
    );
  },
);
