"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { attendanceSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export function AttendanceTabView({
  lang,
  dict,
  sheetTitle,
}: {
  lang: string;
  dict: any;
  sheetTitle: string;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance-sheets", "preview", sheetTitle],
    queryFn: () =>
      attendanceSheetsApi
        .preview({ sheetTitle, takeRows: 60 })
        .then((r) => r.data.data as PreviewResponse),
    enabled: Boolean(sheetTitle),
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="container space-y-4">
      <PageHeader
        title={dict?.attendance?.viewTab ?? "View attendance tab"}
        description={sheetTitle}
        actions={
          <Button variant="outline" asChild>
            <Link
              href={`/${lang}/dashboard/attendance/${encodeURIComponent(
                sheetTitle,
              )}/edit`}
            >
              {dict?.common?.edit ?? "Edit"}
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
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
              {dict?.attendance?.emptyPreview ?? "No data in this tab yet."}
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {header.map((h, idx) => (
                      <TableHead key={idx} className="whitespace-nowrap">
                        {h || (idx < 3 ? "-" : "(date)")}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {body.map((r, ridx) => (
                    <TableRow key={ridx}>
                      {header.map((_, cidx) => (
                        <TableCell key={cidx} className="whitespace-nowrap">
                          {String(r?.[cidx] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        {dict?.attendance?.viewHint ??
          "This is a live preview of the Google Sheet. If you recently changed values, run sync in Sheets → Attendance."}
      </div>
    </div>
  );
}
