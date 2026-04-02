"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AttCell({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  const displayValue = value
    ? value === "PRESENT"
      ? "P"
      : value === "ABSENT"
        ? "A"
        : value === "LATE"
          ? "L"
          : value === "EXCUSED"
            ? "E"
            : value
    : "";

  return (
    <Select value={displayValue} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="-" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
