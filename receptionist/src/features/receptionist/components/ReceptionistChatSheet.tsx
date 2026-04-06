"use client";

import React from "react";

import { Sheet, SheetContent } from "@/components/ui/sheet";

import type { ReceptionistInitData } from "../types";
import { ReceptionistChatPanel } from "./ReceptionistChatPanel";

export function ReceptionistChatSheet(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ReceptionistInitData | null;
  initialError: string | null;
}) {
  const { open, onOpenChange, initialData, initialError } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[520px] p-0"
        aria-describedby={undefined}
      >
        <ReceptionistChatPanel
          initialData={initialData}
          initialError={initialError}
        />
      </SheetContent>
    </Sheet>
  );
}
