"use client";

import * as React from "react";

import { SourceSpreadsheet } from "@/components/sheets/SourceSpreadsheet";
import { SyncPerformance } from "@/components/sheets/SyncPerformance";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

type AttendanceSheetsOverviewProps = {
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

export function AttendanceSheetsOverview({
  dict,
  healthLoading,
  health,
  statusLoading,
  status,
  spreadsheetIdDraft,
  onSpreadsheetIdDraftChange,
  onConnect,
  isConnecting,
}: AttendanceSheetsOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <SourceSpreadsheet
        dict={dict}
        description="Attendance (tabs = GROUP_SUBJECT)"
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
            label: "Synced records",
            value: status?.syncedRecords ?? 0,
          },
          {
            label: "Roster changes",
            value: `+${status?.rosterAdded ?? 0} / ~${status?.rosterUpdated ?? 0}`,
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
          {
            label: "Worker Heartbeat",
            value: status?.worker?.running
              ? formatDateTime(status?.worker?.lastHeartbeatAt)
              : "Stopped",
            valueClassName: status?.worker?.running
              ? "text-emerald-600"
              : undefined,
          },
        ]}
        error={status?.lastError ?? null}
      />
    </div>
  );
}
