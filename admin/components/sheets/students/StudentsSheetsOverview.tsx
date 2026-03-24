"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Layers, RefreshCw } from "lucide-react";
import { SourceSpreadsheet } from "@/components/sheets/SourceSpreadsheet";
import { SyncPerformance } from "@/components/sheets/SyncPerformance";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

type StudentsSheetsOverviewProps = {
  dict: any;
  healthLoading: boolean;
  health: any;
  statusLoading: boolean;
  status: any;
  groupsStatus: any;
  onSyncGroups: () => void;
  isSyncingGroups: boolean;
  spreadsheetIdDraft: string;
  onSpreadsheetIdDraftChange: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
  openConflicts: number;
};

export function StudentsSheetsOverview({
  dict,
  healthLoading,
  health,
  statusLoading,
  status,
  groupsStatus,
  onSyncGroups,
  isSyncingGroups,
  spreadsheetIdDraft,
  onSpreadsheetIdDraftChange,
  onConnect,
  isConnecting,
  openConflicts,
}: StudentsSheetsOverviewProps) {
  return (
    <div className="space-y-6">
      {/* RIGHT COLUMN: Performance & Monitoring */}
      <div className="space-y-8">
        <SyncPerformance
          title={dict?.sheets?.queueTitle ?? "Sync Monitor"}
          description="Real-time data flow and engine health."
          status={status?.lastStatus ?? null}
          loading={statusLoading}
          metrics={[
            { label: "DB Students", value: status?.syncedStudents ?? 0 },
            { label: "Sheet Rows", value: status?.spreadsheetRows ?? 0 },
            { label: "Conflicts", value: openConflicts, tone: "warning" },
            { label: "Groups", value: status?.detectedGroups?.length ?? 0 },
          ]}
          rows={[
            {
              label: "Sync Trace ID",
              value: status?.lastRunId
                ? String(status.lastRunId).slice(0, 12)
                : "-",
              valueClassName: "font-mono text-zinc-400",
            },
            {
              label: "Last Success",
              value: formatDateTime(status?.lastSyncAt),
            },
            {
              label: "Engine Heartbeat",
              value: status?.worker?.running ? (
                <span className="flex items-center gap-2 text-emerald-400 font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  {formatDateTime(status?.worker?.lastHeartbeatAt)}
                </span>
              ) : (
                <span className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">
                  Inactive
                </span>
              ),
            },
          ]}
          error={status?.lastError ?? null}
          className="h-full"
        />
      </div>
      {/* LEFT COLUMN: Configuration & Groups */}
      <div className="flex gap-6">
        <SourceSpreadsheet
          dict={dict}
          description="Google Sheet endpoint configuration"
          healthLoading={healthLoading}
          health={health}
          spreadsheetIdDraft={spreadsheetIdDraft}
          onSpreadsheetIdDraftChange={onSpreadsheetIdDraftChange}
          onConnect={onConnect}
          isConnecting={isConnecting}
          className="rounded-[34px] border-white/5 bg-zinc-900/20 backdrop-blur-xl"
        />

        <Card className="rounded-[34px] border-white/5 bg-zinc-900/20 backdrop-blur-xl overflow-hidden shadow-none">
          <CardHeader className="p-8 pb-4 flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-zinc-500" />
                <CardTitle className="text-lg font-bold tracking-tight text-white">
                  {dict?.groups?.title ?? "Groups Engine"}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                {dict?.sheets?.groupsSectionDesc ??
                  "Automated group extraction from student tabs."}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSyncGroups}
              disabled={isSyncingGroups || !groupsStatus?.enabled}
              className="h-9 rounded-full px-4 font-bold text-[10px] uppercase tracking-widest bg-white/[0.03] hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5"
            >
              <RefreshCw
                className={cn("size-3 mr-2", isSyncingGroups && "animate-spin")}
              />
              {isSyncingGroups ? "Syncing" : "Sync Groups"}
            </Button>
          </CardHeader>

          <CardContent className="p-8 pt-2 space-y-6">
            {!groupsStatus?.enabled ? (
              <div className="py-4 text-xs font-medium text-zinc-600 italic uppercase tracking-widest">
                Integration is currently disabled.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] bg-white/[0.03] border border-white/[0.05] p-5">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                      Valid Tabs
                    </div>
                    <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                      {groupsStatus.validGroupTabs.length}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-white/[0.03] border border-white/[0.05] p-5">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                      Ignored
                    </div>
                    <div className="text-3xl font-black text-zinc-400 tabular-nums tracking-tighter">
                      {groupsStatus.ignoredTabs.length}
                    </div>
                  </div>
                </div>

                {/* Missing Tabs Section */}
                {(groupsStatus.dbGroupsMissingTabs.length > 0 ||
                  groupsStatus.validTabsMissingDbGroups.length > 0) && (
                  <div className="space-y-4 pt-2">
                    <div className="h-px bg-white/[0.05]" />
                    <div className="space-y-4">
                      <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                        Sync Anomalies
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {groupsStatus.dbGroupsMissingTabs
                          .slice(0, 15)
                          .map((g: any) => (
                            <Badge
                              key={g.id}
                              variant="outline"
                              className="rounded-full border-red-500/10 bg-red-500/5 text-red-500/80 text-[9px] font-bold px-2 py-0"
                            >
                              Missing: {g.name}
                            </Badge>
                          ))}
                        {groupsStatus.validTabsMissingDbGroups
                          .slice(0, 15)
                          .map((t: string) => (
                            <Badge
                              key={t}
                              variant="outline"
                              className="rounded-full border-emerald-500/10 bg-emerald-500/5 text-emerald-500/80 text-[9px] font-bold px-2 py-0"
                            >
                              New: {t}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
