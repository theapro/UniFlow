"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const GRADE_NONE_VALUE = "__NONE__";

export function GradeCell({
  value,
  onChange,
  options,
}: {
  value: number | null | undefined;
  onChange: (value: string) => void;
  options: string[];
}) {
  // Radix Select forbids SelectItem value="".
  const display =
    value === null || value === undefined ? GRADE_NONE_VALUE : String(value);
  return (
    <Select value={display} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="-" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o === GRADE_NONE_VALUE ? "-" : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
