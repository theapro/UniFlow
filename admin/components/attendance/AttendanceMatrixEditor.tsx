"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  loadAttendanceTableAction,
  saveAttendanceTableAction,
} from "@/components/attendance/attendance-table.actions";
import { AttCell } from "@/components/attendance/AttCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AttendanceCellValue,
  AttendanceTableData,
} from "@/types/attendance-grades.types";

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "P", value: "P" },
  { label: "A", value: "A" },
  { label: "L", value: "L" },
  { label: "E", value: "E" },
];

function normalizeCellValue(v: string): AttendanceCellValue {
  const upper = String(v ?? "")
    .trim()
    .toUpperCase();
  if (upper === "P" || upper === "A" || upper === "L" || upper === "E") {
    return upper as any;
  }
  return upper as any;
}

export function AttendanceMatrixEditor({
  lang,
  dict,
  group,
  cohort,
  subjects,
  initialSubjectId,
  initialFrom,
  initialTo,
  initialTable,
}: {
  lang: string;
  dict: any;
  group: { id: string; name: string; cohortId: string | null };
  cohort: { id: string; code: string } | null;
  subjects: Array<{ id: string; name: string }>;
  initialSubjectId: string;
  initialFrom: string;
  initialTo: string;
  initialTable: AttendanceTableData;
}) {
  const cohortId = group.cohortId ?? null;

  const [subjectId, setSubjectId] = React.useState(initialSubjectId);
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);

  const [table, setTable] = React.useState<AttendanceTableData>(initialTable);
  const [dirty, setDirty] = React.useState(() => new Map<string, string>());
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const viewHref = React.useMemo(() => {
    const qs = new URLSearchParams({
      groupId: group.id,
      subjectId,
      from,
      to,
    });
    return `/${lang}/dashboard/attendance/view?${qs.toString()}`;
  }, [lang, group.id, subjectId, from, to]);

  async function load() {
    setIsLoading(true);
    try {
      const res = await loadAttendanceTableAction({
        cohortId,
        groupId: group.id,
        subjectId,
        from,
        to,
      });

      if (!res.ok) {
        toast.error(
          res.status === 403
            ? "Forbidden: missing VIEW_ATTENDANCE permission"
            : res.message,
        );
        return;
      }

      setTable(res.data);
      setDirty(new Map());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load attendance table");
    } finally {
      setIsLoading(false);
    }
  }

  async function save() {
    if (dirty.size === 0) return;
    setIsSaving(true);

    try {
      const records: Array<{
        studentId: string;
        date: string;
        status: string;
      }> = [];
      for (const [key, status] of dirty) {
        const [studentId, date] = key.split("@@");
        if (!studentId || !date) continue;
        records.push({ studentId, date, status });
      }

      const res = await saveAttendanceTableAction({
        cohortId,
        groupId: group.id,
        subjectId,
        dates: table.dates,
        records,
      });

      if (!res.ok) {
        toast.error(
          res.status === 403
            ? "Forbidden: missing EDIT_ATTENDANCE permission"
            : res.message,
        );
        return;
      }

      toast.success(dict?.common?.success ?? "Saved");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  }

  function onChangeCell(studentId: string, date: string, value: string) {
    const normalized = String(value ?? "").trim();
    const key = `${studentId}@@${date}`;

    setDirty((prev) => {
      const next = new Map(prev);
      next.set(key, normalized);
      return next;
    });

    setTable((prev) => {
      const nextRows = prev.rows.map((r) => {
        if (r.studentId !== studentId) return r;
        return {
          ...r,
          cells: { ...r.cells, [date]: normalizeCellValue(normalized) },
        };
      });
      return { ...prev, rows: nextRows };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            {cohort ? `${cohort.code} • ` : ""}
            {dict?.schedule?.group ?? "Group"}
          </div>
          <div className="text-xl font-semibold tracking-tight">
            {group.name}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href={viewHref}>{dict?.common?.view ?? "View"}</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="min-w-[240px]">
          <div className="text-xs text-muted-foreground mb-1">
            {dict?.schedule?.subject ?? "Subject"}
          </div>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="rounded-2xl">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[160px]">
          <div className="text-xs text-muted-foreground mb-1">From</div>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-2xl"
          />
        </div>

        <div className="min-w-[160px]">
          <div className="text-xs text-muted-foreground mb-1">To</div>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-2xl"
          />
        </div>

        <Button
          variant="secondary"
          onClick={load}
          disabled={isLoading || isSaving}
          className="rounded-2xl"
        >
          {isLoading ? (dict?.common?.loading ?? "Loading...") : "Load"}
        </Button>

        <Button
          onClick={save}
          disabled={isSaving || dirty.size === 0}
          className="rounded-2xl"
        >
          {isSaving ? "Saving..." : `Save (${dirty.size})`}
        </Button>
      </div>

      <div
        className={cn(
          "rounded-[28px] border border-border/40 bg-muted/10 overflow-auto",
          isLoading && "opacity-60",
        )}
        style={{ maxHeight: "70vh" }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background/80 backdrop-blur z-10">
            <tr className="border-b border-border/40">
              <th className="text-left font-medium p-3 w-[140px]">Student #</th>
              <th className="text-left font-medium p-3 min-w-[240px]">
                Full name
              </th>
              {table.dates.map((d) => (
                <th key={d} className="text-left font-medium p-3 min-w-[120px]">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr
                key={r.studentId}
                className="border-b border-border/20 last:border-b-0"
              >
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {r.studentNumber}
                </td>
                <td className="p-3 whitespace-nowrap">{r.fullName}</td>
                {table.dates.map((d) => (
                  <td key={d} className="p-2">
                    <AttCell
                      value={(r.cells[d] ?? null) as any}
                      onChange={(v: string) => onChangeCell(r.studentId, d, v)}
                      options={STATUS_OPTIONS}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.dates.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No scheduled lesson days in this date range.
        </div>
      ) : null}
    </div>
  );
}
