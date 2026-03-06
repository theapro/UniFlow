"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SyncLogs } from "./SyncLogs";
import { ConflictManager } from "./ConflictManager";
import { RefreshCcw, LayoutGrid, AlertTriangle, ListFilter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StudentsSheetsStatusResponse = {
  enabled: boolean;
  dbToSheetsEnabled: boolean;
  detectDeletes: boolean;
  spreadsheetId: string | null;
  spreadsheetIdMasked?: string | null;
  syncedStudents: number;
  spreadsheetRows: number;
  detectedGroups: string[];
  lastRunId: string | null;
  lastStatus: "SUCCESS" | "FAILED" | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  openConflicts?: number;
  worker: {
    enabled: boolean;
    intervalMs: number;
    lastHeartbeatAt: string | null;
    running: boolean;
    lastError: string | null;
  };
  recentLogs: Array<{
    createdAt: string;
    level: "INFO" | "WARN" | "ERROR";
    direction: "SHEETS_TO_DB" | "DB_TO_SHEETS" | "WORKER";
    action: string;
    sheetTitle: string | null;
    studentId: string | null;
    message: string;
  }>;
};

type SheetsHealthResponse = {
  config: {
    enabled: boolean;
    workerEnabled: boolean;
    workerIntervalMs: number;
    spreadsheetId: string | null;
    spreadsheetIdMasked?: string | null;
    clientEmail: string | null;
    privateKeyProvided: boolean;
  };
  connection:
    | {
        attempted: false;
        ok: false;
        error: string;
      }
    | {
        attempted: true;
        ok: true;
        spreadsheet: { id: string; title: string | null };
        sheetTitles: string[];
      }
    | {
        attempted: true;
        ok: false;
        error: string;
      };
};

type ConflictListResponse = {
  status: "OPEN" | "RESOLVED";
  items: Array<{
    id: string;
    status: "OPEN" | "RESOLVED";
    resolution: "KEEP_SHEET" | "KEEP_DB" | "MERGE" | null;
    spreadsheetId: string;
    sheetTitle: string | null;
    rowNumber: number | null;
    studentId: string | null;
    message: string | null;
    detectedAt: string;
    resolvedAt: string | null;
  }>;
};

type ConflictDetail = {
  id: string;
  status: "OPEN" | "RESOLVED";
  resolution: "KEEP_SHEET" | "KEEP_DB" | "MERGE" | null;
  spreadsheetId: string;
  sheetTitle: string | null;
  rowNumber: number | null;
  studentId: string | null;
  message: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  sheetPayload: any;
  dbPayload: any;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function SheetsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();
  const [selectedConflictId, setSelectedConflictId] = React.useState<
    string | null
  >(null);

  const syncMutation = useMutation({
    mutationFn: () => sheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["sheets", "health"] });
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["sheets", "health"],
    queryFn: () =>
      sheetsApi.health().then((r) => r.data.data as SheetsHealthResponse),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["sheets", "status"],
    queryFn: () =>
      sheetsApi
        .status()
        .then((r) => r.data.data as StudentsSheetsStatusResponse),
    refetchInterval: 15_000,
  });

  const { data: conflicts } = useQuery({
    queryKey: ["sheets", "conflicts", "open"],
    queryFn: () =>
      sheetsApi.conflicts
        .list({ status: "OPEN", take: 25 })
        .then((r) => r.data.data as ConflictListResponse),
    refetchInterval: 15_000,
  });

  const { data: conflictDetail } = useQuery({
    queryKey: ["sheets", "conflicts", selectedConflictId],
    queryFn: () =>
      selectedConflictId
        ? sheetsApi.conflicts
            .getById(selectedConflictId)
            .then((r) => r.data.data as ConflictDetail)
        : Promise.resolve(null as any),
    enabled: Boolean(selectedConflictId),
  });

  const resolveMutation = useMutation({
    mutationFn: (data: any) =>
      selectedConflictId
        ? sheetsApi.conflicts
            .resolve(selectedConflictId, data)
            .then((r) => r.data.data)
        : Promise.reject(new Error("NO_CONFLICT_SELECTED")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["sheets", "conflicts"] });
      setSelectedConflictId(null);
    },
  });

  const title = dict?.nav?.sheets ?? "Students Sheets";

  return (
    <div className="container space-y-6 max-w-7xl mx-auto py-4">
      <PageHeader
        title={title}
        description={
          dict?.sheets?.description ??
          "Manage synchronization between Google Sheets and Database."
        }
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="font-semibold shadow-sm"
            >
              <RefreshCcw className={"h-4 w-4 mr-2 " + (syncMutation.isPending ? "animate-spin" : "")} />
              {syncMutation.isPending ? "Syncing..." : "Force Sync"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ["sheets", "status"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["sheets", "health"],
                });
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-[400px] grid-cols-2 mb-4 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Conflicts
            {((conflicts?.items ?? []).length > 0) && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                {(conflicts?.items.length)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1fr_2fr]">
            <Card className="h-fit">
              <CardHeader className="pb-3 border-b border-muted/30">
                <CardTitle className="text-xl">
                  {dict?.sheets?.connectionTitle ?? "Source Spreadsheet"}
                </CardTitle>
                <CardDescription>Target Google Sheet configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {healthLoading ? (
                  <div>{dict?.common?.loading ?? "Loading..."}</div>
                ) : health ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={health.config?.enabled ? "default" : "outline"}
                      >
                        {health.config?.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge
                        variant={
                          health.config?.workerEnabled ? "default" : "outline"
                        }
                      >
                        {health.config?.workerEnabled
                          ? "Auto Sync"
                          : "Manual Only"}
                      </Badge>
                      <Badge
                        variant={
                          (health.connection as any)?.ok
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {(health.connection as any)?.attempted
                          ? (health.connection as any)?.ok
                            ? "Connected"
                            : "Error"
                          : "Not configured"}
                      </Badge>
                    </div>

                    {health.connection.attempted && health.connection.ok ? (
                      <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-muted">
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Spreadsheet ID
                          </span>{" "}
                          <span className="font-mono text-[11px] break-all bg-background p-1 rounded border inline-block w-full">
                            {health.connection.spreadsheet.id ??
                              health.config?.spreadsheetId ??
                              "-"}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Title
                          </span>{" "}
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {health.connection.spreadsheet.title ?? "(untitled)"}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Detected Groups (tabs)
                          </span>{" "}
                          <span className="font-medium">
                            {health.connection.sheetTitles.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {health.connection.sheetTitles.map((title, i) => (
                             <Badge key={i} variant="outline" className="text-[10px] py-0">{title}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : health.connection.attempted && !health.connection.ok ? (
                      <div className="text-sm flex gap-2 p-3 rounded-lg bg-red-50 text-red-900 border border-red-100 dark:bg-red-950/20 dark:text-red-200 dark:border-red-900">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        {health.connection.error}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        {health.connection.error}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No source configuration found.</div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b border-muted/30 flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">
                      {dict?.sheets?.queueTitle ?? "Sync Performance"}
                    </CardTitle>
                    <CardDescription>Real-time status of data synchronization.</CardDescription>
                  </div>
                  <Badge
                    className="font-mono text-[10px]"
                    variant={
                      status?.lastStatus === "SUCCESS"
                        ? "secondary"
                        : status?.lastStatus === "FAILED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    STATUS: {status?.lastStatus ?? "IDLE"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-6">
                  {statusLoading ? (
                    <div>{dict?.common?.loading ?? "Loading..."}</div>
                  ) : status ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                             Students in DB
                          </div>
                          <div className="text-2xl font-black tabular-nums">
                            {status.syncedStudents}
                          </div>
                        </div>
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Rows in Sheets
                          </div>
                          <div className="text-2xl font-black tabular-nums">
                            {status.spreadsheetRows}
                          </div>
                        </div>
                        <div className="rounded-xl border bg-card p-4 shadow-sm border-orange-200 bg-orange-50/20 dark:border-orange-950 dark:bg-orange-950/10">
                          <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-2">
                            Open Conflicts
                          </div>
                          <div className="text-2xl font-black tabular-nums text-orange-600 dark:text-orange-400">
                            {status.openConflicts ?? conflicts?.items?.length ?? 0}
                          </div>
                        </div>
                        <div className="rounded-xl border bg-card p-4 shadow-sm">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                            Detected Groups
                          </div>
                          <div className="text-2xl font-black tabular-nums">
                            {status.detectedGroups.length}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs divide-y">
                        <div className="flex justify-between py-1.5 px-1">
                          <span className="text-muted-foreground">Last Run ID</span>
                          <span className="font-mono">{status.lastRunId ? status.lastRunId.slice(0, 12) : "-"}</span>
                        </div>
                        <div className="flex justify-between py-1.5 px-1">
                          <span className="text-muted-foreground">Last Synchronization</span>
                          <span className="font-medium">{formatDateTime(status.lastSyncAt)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 px-1">
                          <span className="text-muted-foreground">Worker Pulsar (Heartbeat)</span>
                          <span className="font-medium text-emerald-600">
                             {status.worker?.running ? (
                                <span className="flex items-center gap-1.5">
                                   <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                   {formatDateTime(status.worker?.lastHeartbeatAt)}
                                </span>
                             ) : "Stopped"}
                          </span>
                        </div>
                      </div>

                      {status.lastError ? (
                        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                          {status.lastError}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Sync status information is unavailable.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="conflicts" className="outline-none">
          <ConflictManager 
              conflicts={conflicts?.items ?? []}
              conflictDetail={conflictDetail}
              selectedConflictId={selectedConflictId}
              setSelectedConflictId={setSelectedConflictId}
              isResolving={resolveMutation.isPending}
              onResolve={(data) => resolveMutation.mutate(data)}
              dict={dict}
            />
        </TabsContent>
      </Tabs>

      {/* NEW: Logs section moved to bottom and expanded */}
      <Card className="mt-8 border-t-2 border-t-primary/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/10">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <ListFilter className="h-5 w-5 text-primary" />
              Synchronization Logs
            </CardTitle>
            <CardDescription>Historical activity of the Sheets sync engine</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {status?.recentLogs?.length ?? 0} ENTRIES
          </Badge>
        </CardHeader>
        <CardContent className="pt-4">
             <SyncLogs logs={status?.recentLogs ?? []} dict={dict} />
        </CardContent>
      </Card>
    </div>
  );
}
