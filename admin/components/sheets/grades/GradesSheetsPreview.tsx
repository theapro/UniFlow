"use client";

import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GradesSheetsPreviewProps = {
  tabs: any;
  selectedTab: string;
  onSelectedTabChange: (value: string) => void;
  previewLoading: boolean;
  preview: { rows: string[][] } | null | undefined;
};

export function GradesSheetsPreview({
  tabs,
  selectedTab,
  onSelectedTabChange,
  previewLoading,
  preview,
}: GradesSheetsPreviewProps) {
  const previewRows = preview?.rows ?? [];
  const header = previewRows[0] ?? [];
  const bodyRows = previewRows.slice(1);

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-muted/30">
        <CardTitle className="text-xl">Tab Preview</CardTitle>
        <CardDescription>
          Pick a GROUP_SUBJECT tab and preview its rows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="w-[360px]">
            <Select value={selectedTab} onValueChange={onSelectedTabChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a tab" />
              </SelectTrigger>
              <SelectContent>
                {(tabs?.items ?? []).map((t: any) => (
                  <SelectItem key={t.sheetTitle} value={t.sheetTitle}>
                    {t.sheetTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTab && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{selectedTab}</Badge>
            </div>
          )}
        </div>

        {previewLoading ? (
          <div className="text-sm text-muted-foreground">
            Loading preview...
          </div>
        ) : header.length === 0 ? (
          <div className="text-sm text-muted-foreground">No rows found</div>
        ) : (
          <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {header.slice(0, 20).map((h, idx) => (
                      <TableHead key={idx} className="whitespace-nowrap">
                        {h || "(blank)"}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bodyRows.slice(0, 29).map((row, rIdx) => (
                    <TableRow key={rIdx}>
                      {header.slice(0, 20).map((_h, cIdx) => (
                        <TableCell key={cIdx} className="whitespace-nowrap">
                          {row[cIdx] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Preview shows up to 20 columns and 30 rows.
        </div>
      </CardContent>
    </Card>
  );
}
