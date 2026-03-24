"use client";

import * as React from "react";

import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type SheetsTabsListProps = React.ComponentPropsWithoutRef<typeof TabsList> & {
  columns: 2 | 3 | 4;
};

export function SheetsTabsList({
  columns,
  className,
  children,
  ...props
}: SheetsTabsListProps) {
  const colsClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 3
        ? "grid-cols-3"
        : "grid-cols-4";

  return (
    <TabsList
      className={cn(
        "grid w-[520px] max-w-full bg-muted/50 p-1",
        colsClass,
        className,
      )}
      {...props}
    >
      {children}
    </TabsList>
  );
}
