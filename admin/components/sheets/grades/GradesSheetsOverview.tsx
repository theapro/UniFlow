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

type GradesSheetsOverviewProps = {
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

export function GradesSheetsOverview({
  dict,
  healthLoading,
  health,
  statusLoading,
  status,
  spreadsheetIdDraft,
  onSpreadsheetIdDraftChange,
  onConnect,
  isConnecting,
}: GradesSheetsOverviewProps) {
  const errors = (status?.errors ?? []) as Array<{
    sheetTitle: string;
    message: string;
  }>;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SourceSpreadsheet
        dict={dict}
        description="Grades (tabs = GROUP_SUBJECT)"
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
            label: "Processed tabs",
            value: status?.processedTabs ?? 0,
          },
          {
            label: "Spreadsheet rows",
            value: status?.spreadsheetRows ?? 0,
          },
          {
            label: "Roster added",
            value: status?.rosterAdded ?? 0,
          },
          {
            label: "Roster updated",
            value: status?.rosterUpdated ?? 0,
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
        ]}
        error={status?.lastError ?? null}
      >
        {errors.length ? (
          <div className="space-y-2 pt-2 border-t border-muted/30">
            <div className="text-xs uppercase font-bold text-muted-foreground">
              Errors
            </div>
            <div className="flex flex-col gap-2">
              {errors.slice(0, 20).map((e, idx) => (
                <div
                  key={`${e.sheetTitle}-${idx}`}
                  className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs"
                >
                  <div className="font-semibold text-destructive mb-1">
                    {e.sheetTitle}
                  </div>
                  <div className="text-muted-foreground break-words font-mono">
                    {e.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SyncPerformance>
    </div>
  );
}
