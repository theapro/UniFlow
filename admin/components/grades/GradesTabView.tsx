"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { gradesSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
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

export function GradesTabView({
  lang,
  dict,
  sheetTitle,
}: {
  lang: string;
  dict: any;
  sheetTitle: string;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["grades-sheets", "preview", sheetTitle],
    queryFn: () =>
      gradesSheetsApi
        .preview({ sheetTitle, takeRows: 60 })
        .then((r) => r.data.data as PreviewResponse),
    enabled: Boolean(sheetTitle),
    refetchInterval: 60_000,
  });

  const rows = data?.rows ?? [];
  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.grades?.viewTab ?? "View grades tab"}
        description={sheetTitle}
        actions={
          <Button asChild variant="outline" className="rounded-2xl">
            <Link
              href={`/${lang}/dashboard/grades/${encodeURIComponent(
                sheetTitle,
              )}/edit`}
            >
              {dict?.common?.edit ?? "Edit"}
            </Link>
          </Button>
        }
      />

      <section className="rounded-[32px] border border-border/40 bg-muted/10 p-6">
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
          <div className="rounded-3xl border border-border/40 bg-background/50 overflow-hidden">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {header.map((h, idx) => (
                      <TableHead key={idx} className="whitespace-nowrap">
                        {h || (idx < 3 ? "-" : "(HW)")}
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
          </div>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        {dict?.grades?.viewHint ??
          "This is a live preview of the Google Sheet. Teachers enter grades directly in Google Sheets (columns after C)."}
      </div>
    </div>
  );
}
