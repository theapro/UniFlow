"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  loadGradesTableAction,
  saveGradesTableAction,
} from "@/components/grades/grades-table.actions";
import { GradeCell, GRADE_NONE_VALUE } from "@/components/grades/GradeCell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GradesTableData } from "@/types/attendance-grades.types";

const GRADE_OPTIONS = [GRADE_NONE_VALUE, "0", "1", "2", "3", "4", "5"];

export function GradesMatrixEditor({
  lang,
  dict,
  group,
  cohort,
  subjects,
  initialSubjectId,
  initialTable,
}: {
  lang: string;
  dict: any;
  group: { id: string; name: string; cohortId: string | null };
  cohort: { id: string; code: string } | null;
  subjects: Array<{ id: string; name: string }>;
  initialSubjectId: string;
  initialTable: GradesTableData;
}) {
  const cohortId = group.cohortId ?? null;

  const [subjectId, setSubjectId] = React.useState(initialSubjectId);
  const [table, setTable] = React.useState<GradesTableData>(initialTable);

  const [dirty, setDirty] = React.useState(() => new Map<string, string>());
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const viewHref = React.useMemo(() => {
    const qs = new URLSearchParams({ groupId: group.id, subjectId });
    return `/${lang}/dashboard/grades/view?${qs.toString()}`;
  }, [lang, group.id, subjectId]);

  async function load() {
    setIsLoading(true);
    try {
      const res = await loadGradesTableAction({
        cohortId,
        groupId: group.id,
        subjectId,
      });

      if (!res.ok) {
        toast.error(
          res.status === 403
            ? "Forbidden: missing VIEW_GRADES permission"
            : res.message,
        );
        return;
      }

      setTable(res.data);
      setDirty(new Map());
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load grades table");
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
        assignmentIndex: number;
        grade: number | null;
      }> = [];

      for (const [key, gradeStr] of dirty) {
        const [studentId, idxStr] = key.split("@@");
        const assignmentIndex = Number(idxStr);
        const grade = gradeStr === "" ? null : Number(gradeStr);

        if (!studentId || !Number.isFinite(assignmentIndex)) continue;

        records.push({
          studentId,
          assignmentIndex,
          grade: Number.isFinite(grade) ? grade : null,
        });
      }

      const res = await saveGradesTableAction({
        cohortId,
        groupId: group.id,
        subjectId,
        assignmentCount: table.assignmentCount,
        records,
      });

      if (!res.ok) {
        toast.error(
          res.status === 403
            ? "Forbidden: missing EDIT_GRADES permission"
            : res.message,
        );
        return;
      }

      toast.success(dict?.common?.success ?? "Saved");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save grades");
    } finally {
      setIsSaving(false);
    }
  }

  function onChangeCell(studentId: string, col: string, value: string) {
    const normalized = value === GRADE_NONE_VALUE ? "" : value;
    const key = `${studentId}@@${col}`;

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
          cells: {
            ...r.cells,
            [col]: normalized === "" ? null : Number(normalized),
          },
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
        <div className="min-w-[260px]">
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
              {table.columns.map((c) => (
                <th key={c} className="text-left font-medium p-3 min-w-[90px]">
                  {c}
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
                {table.columns.map((c) => (
                  <td key={c} className="p-2">
                    <GradeCell
                      value={r.cells[c]}
                      onChange={(v: string) => onChangeCell(r.studentId, c, v)}
                      options={GRADE_OPTIONS}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        {dict?.grades?.editHint ??
          "Tip: Use Load after switching subject, then Save to persist changes."}
      </div>
    </div>
  );
}
