"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { SourceSpreadsheet } from "@/components/sheets/SourceSpreadsheet";
import { SyncPerformance } from "@/components/sheets/SyncPerformance";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

type TeachersSheetsOverviewProps = {
  dict: any;
  healthLoading: boolean;
  health: any;
  statusLoading: boolean;
  status: any;
  spreadsheetIdDraft: string;
  onSpreadsheetIdDraftChange: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
};

export function TeachersSheetsOverview({
  dict,
  healthLoading,
  health,
  statusLoading,
  status,
  spreadsheetIdDraft,
  onSpreadsheetIdDraftChange,
  onConnect,
  isConnecting,
}: TeachersSheetsOverviewProps) {
  const detectedSubjects = (status?.detectedSubjects ?? []) as string[];
  const fallbackSubjects = (health?.connection?.sheetTitles ?? []) as string[];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SourceSpreadsheet
        dict={dict}
        description="TeachersWithSubjects (tabs = subjects)"
        healthLoading={healthLoading}
        health={health}
        spreadsheetIdDraft={spreadsheetIdDraft}
        onSpreadsheetIdDraftChange={onSpreadsheetIdDraftChange}
        onConnect={onConnect}
        isConnecting={isConnecting}
      />

      <SyncPerformance
        title="Sync Status"
        description="Last run and counters"
        status={status?.lastStatus ?? null}
        loading={statusLoading}
        metrics={[
          {
            label: "Synced teachers",
            value: status?.syncedTeachers ?? 0,
          },
          {
            label: "Spreadsheet rows",
            value: status?.spreadsheetRows ?? 0,
          },
          {
            label: "Subjects detected",
            value: detectedSubjects.length,
          },
        ]}
        rows={[
          {
            label: "Last Run ID",
            value: status?.lastRunId
              ? String(status.lastRunId).slice(0, 12)
              : "-",
            valueClassName: "font-mono",
          },
          {
            label: "Last Synchronization",
            value: formatDateTime(status?.lastSyncAt),
          },
          {
            label: "Last Success",
            value: formatDateTime(status?.lastSuccessAt),
          },
        ]}
        error={status?.lastError ?? null}
      >
        <div className="space-y-2 pt-2 border-t border-muted/30">
          <div className="text-xs uppercase font-bold text-muted-foreground">
            Detected Subject Tabs
          </div>
          <div className="flex flex-wrap gap-2">
            {detectedSubjects.length ? (
              detectedSubjects.map((s) => (
                <Badge key={s} variant="outline" className="bg-background/50">
                  {s}
                </Badge>
              ))
            ) : Array.isArray(fallbackSubjects) && fallbackSubjects.length ? (
              fallbackSubjects.map((s) => (
                <Badge key={s} variant="outline" className="opacity-50">
                  {s} (pending sync)
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground italic">
                No subjects detected yet
              </span>
            )}
          </div>
        </div>
      </SyncPerformance>
    </div>
  );
}
