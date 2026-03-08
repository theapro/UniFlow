"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { gradesSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PreviewResponse = {
  sheetTitle: string;
  rows: string[][];
};

function detectAssignmentCountFromHeader(header: string[]): number {
  const rest = (header ?? []).slice(3);
  let count = 0;
  for (const cell of rest) {
    const v = String(cell ?? "").trim();
    if (!v) break;
    if (/^HW\d+$/i.test(v)) count++;
    else break;
  }
  return count;
}

export function GradesTabEditView({
  lang,
  dict,
  sheetTitle,
}: {
  lang: string;
  dict: any;
  sheetTitle: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["grades-sheets", "preview", sheetTitle],
    queryFn: () =>
      gradesSheetsApi
        .preview({ sheetTitle, takeRows: 200 })
        .then((r) => r.data.data as PreviewResponse),
    enabled: Boolean(sheetTitle),
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  const initialAssignmentCount = React.useMemo(
    () => detectAssignmentCountFromHeader(header),
    [header],
  );

  const [assignmentCount, setAssignmentCount] = React.useState<number>(
    Math.max(initialAssignmentCount, 1),
  );

  const [matrix, setMatrix] = React.useState<string[][]>([]);
  const [seeded, setSeeded] = React.useState(false);

  React.useEffect(() => {
    if (seeded) return;
    if (!rows.length) return;

    const detected = detectAssignmentCountFromHeader(header);
    const nextCount = Math.max(detected, 1);
    setAssignmentCount(nextCount);

    const nextMatrix = body.map((r) => {
      const hw = (r ?? []).slice(3, 3 + nextCount);
      if (hw.length === nextCount) return hw.map((c) => String(c ?? ""));
      return [
        ...hw.map((c) => String(c ?? "")),
        ...Array(nextCount - hw.length).fill(""),
      ];
    });

    setMatrix(nextMatrix);
    setSeeded(true);
  }, [rows, header, body, seeded]);

  React.useEffect(() => {
    if (!seeded) return;
    setMatrix((prev) => {
      const nextCount = Math.max(1, Math.floor(Number(assignmentCount) || 1));
      return (prev ?? []).map((r) => {
        const row = (r ?? []).slice(0, nextCount);
        if (row.length === nextCount) return row;
        return [...row, ...Array(nextCount - row.length).fill("")];
      });
    });
  }, [assignmentCount, seeded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const count = Math.max(1, Math.floor(Number(assignmentCount) || 1));
      const safeMatrix = (matrix ?? []).map((r) => {
        const row = (r ?? []).slice(0, count).map((c) => String(c ?? ""));
        if (row.length === count) return row;
        return [...row, ...Array(count - row.length).fill("")];
      });

      return gradesSheetsApi
        .updateTab({
          sheetTitle,
          assignmentCount: count,
          gradeValues: safeMatrix,
          gradeStartRowNumber: 2,
        })
        .then((r) => r.data.data);
    },
    onSuccess: async (result: any) => {
      const increasedBy = Number(result?.assignmentCountIncreasedBy ?? 0);
      if (increasedBy > 0) {
        toast.success(
          dict?.common?.success ??
            `Saved (added ${increasedBy} new HW columns)`,
        );
      } else {
        toast.success(dict?.common?.success ?? "Saved");
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["grades-sheets", "preview", sheetTitle],
        }),
        queryClient.invalidateQueries({
          queryKey: ["grades-sheets", "status"],
        }),
      ]);
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to save",
      );
    },
  });

  const hwColumns = Array.from(
    { length: Math.max(1, Math.floor(Number(assignmentCount) || 1)) },
    (_, i) => `HW${i + 1}`,
  );

  return (
    <div className="container space-y-4">
      <PageHeader
        title={dict?.grades?.editTab ?? "Edit grades tab"}
        description={sheetTitle}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link
                href={`/${lang}/dashboard/grades/${encodeURIComponent(
                  sheetTitle,
                )}/view`}
              >
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? (dict?.common?.loading ?? "Saving...")
                : (dict?.common?.save ?? "Save")}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          {isLoading ? (
            <div>{dict?.common?.loading ?? "Loading..."}</div>
          ) : isError ? (
            <div className="text-sm text-destructive">
              {(error as any)?.response?.data?.message ??
                (error as any)?.message ??
                "Failed to load preview"}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {dict?.grades?.emptyPreview ?? "No data in this tab yet."}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">
                    {dict?.attendance?.assignmentCount ??
                      dict?.grades?.assignmentCount ??
                      "Assignments (HW count)"}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={assignmentCount}
                    onChange={(e) => setAssignmentCount(Number(e.target.value))}
                    className="w-40"
                  />
                </div>
                <div className="text-xs text-muted-foreground max-w-xl">
                  {dict?.grades?.editHint ??
                    "Edits here update the Grades sheet directly. Decreasing HW count does not delete existing columns; it only changes which HW columns you edit here."}
                </div>
              </div>

              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        student_uuid
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        student_number
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        fullname
                      </TableHead>
                      {hwColumns.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {body.map((r, ridx) => (
                      <TableRow key={ridx}>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {String(r?.[0] ?? "")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {String(r?.[1] ?? "")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {String(r?.[2] ?? "")}
                        </TableCell>
                        {hwColumns.map((_, cidx) => (
                          <TableCell key={cidx} className="whitespace-nowrap">
                            <Input
                              value={String(matrix?.[ridx]?.[cidx] ?? "")}
                              onChange={(e) => {
                                const v = e.target.value;
                                setMatrix((prev) => {
                                  const next = (prev ?? []).map((row) => [
                                    ...row,
                                  ]);
                                  if (!next[ridx]) next[ridx] = [];
                                  next[ridx][cidx] = v;
                                  return next;
                                });
                              }}
                              className="h-8 w-24"
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        {dict?.grades?.editFooterHint ??
          "Tip: Use Sheets → Grades → Force Sync if roster (A–C) looks outdated."}
      </div>
    </div>
  );
}
