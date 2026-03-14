"use client";

import { useMemo, useState } from "react";
import { CopyPlus } from "lucide-react";
import { toast } from "sonner";

import { monthlyScheduleApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { CellRef, LessonSaved } from "../types";
import { getLessonAtCell, setLessonAtCell } from "../utils/grid";
import {
  getMissingTimeSlotSlotNumber,
  isMissingTimeSlotId,
} from "../utils/timeSlots";
import { useScheduleBuilder } from "./ScheduleBuilderContext";

export function LessonExpandGroupsPopover(props: {
  cell: CellRef;
  lesson: LessonSaved;
}) {
  const { groupsInOrder, grid, setGrid } = useScheduleBuilder();
  const [open, setOpen] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const candidates = useMemo(() => {
    return groupsInOrder
      .filter((g) => !g.id.startsWith("__empty__:"))
      .filter((g) => g.id !== props.cell.groupId)
      .filter((g) => {
        const c = { ...props.cell, groupId: g.id };
        return !getLessonAtCell(grid, c);
      });
  }, [groupsInOrder, props.cell, grid]);

  const canExpand = candidates.length > 0;

  const toggle = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((x) => x !== groupId)
        : [...prev, groupId],
    );
  };

  const onApply = async () => {
    const groupIds = selectedGroupIds;
    setOpen(false);

    if (!groupIds.length) return;

    if (isMissingTimeSlotId(props.cell.timeSlotId)) {
      const slotNo = getMissingTimeSlotSlotNumber(props.cell.timeSlotId);
      toast.error(
        slotNo
          ? `Time slots are not configured (missing slot #${slotNo}). Run backend db seed first.`
          : "Time slots are not configured. Run backend db seed first.",
      );
      return;
    }

    const targets = groupIds
      .map((groupId) => ({ ...props.cell, groupId }))
      .filter((c) => !getLessonAtCell(grid, c));

    if (!targets.length) {
      toast.error("All selected groups already have a lesson in this slot");
      return;
    }

    // Optimistic draft placeholders
    setGrid((prev) => {
      let next = prev;
      for (const c of targets) {
        next = setLessonAtCell(next, c, {
          kind: "draft",
          subjectId: props.lesson.subjectId,
          teacherId: props.lesson.teacherId,
          roomId: props.lesson.roomId ?? null,
          note: props.lesson.note ?? null,
        });
      }
      return next;
    });

    const results = await Promise.allSettled(
      targets.map((c) =>
        monthlyScheduleApi
          .create({
            date: c.date,
            timeSlotId: c.timeSlotId,
            groupId: c.groupId,
            subjectId: props.lesson.subjectId,
            teacherId: props.lesson.teacherId,
            roomId: props.lesson.roomId ?? null,
            note: props.lesson.note ?? null,
          })
          .then((res) => ({ cell: c, row: res.data?.data as any })),
      ),
    );

    let createdCount = 0;
    results.forEach((r, i) => {
      const c = targets[i];
      if (r.status === "fulfilled") {
        createdCount += 1;
        const created = r.value.row as {
          id: string;
          subjectId: string;
          teacherId: string;
          roomId: string | null;
          note?: string | null;
        };
        setGrid((prev) =>
          setLessonAtCell(prev, c, {
            kind: "saved",
            scheduleId: created.id,
            subjectId: created.subjectId,
            teacherId: created.teacherId,
            roomId: created.roomId,
            note: created.note ?? null,
          }),
        );
      } else {
        setGrid((prev) => setLessonAtCell(prev, c, undefined));
        const reason: any = r.reason;
        toast.error(
          reason?.response?.data?.message ??
            "Failed to create lesson for a group",
        );
      }
    });

    if (createdCount) toast.success(`Added to ${createdCount} group(s).`);

    setSelectedGroupIds([]);
  };

  if (!canExpand) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled
        aria-label="Expand to groups"
      >
        <CopyPlus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Expand to groups"
        >
          <CopyPlus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Add to groups</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-56 overflow-auto">
          {candidates.map((g) => (
            <DropdownMenuCheckboxItem
              key={g.id}
              checked={selectedGroupIds.includes(g.id)}
              onCheckedChange={() => toggle(g.id)}
              onSelect={(e) => e.preventDefault()}
            >
              {g.name}
            </DropdownMenuCheckboxItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            void onApply();
          }}
        >
          Apply
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
