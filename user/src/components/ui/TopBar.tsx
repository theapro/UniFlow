"use client";

import React from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function TopBar(props: { title?: string; className?: string }) {
  const { title = "3D LEIA", className } = props;

  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-0 z-30 p-4 sm:p-6",
        "pointer-events-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "pointer-events-auto",
            "text-[11px] font-medium tracking-[0.22em]",
            "text-muted-foreground/80",
          )}
        >
          {title}
        </div>

        <div className="pointer-events-auto">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
