"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { attendanceSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCcw, LayoutGrid, Table as TableIcon, List } from "lucide-react";
import { SyncLogs } from "./SyncLogs";

type AttendanceSheetsHealthResponse = {
  config: {
    enabled: boolean;
    workerEnabled: boolean;
    workerIntervalMs: number;
    spreadsheetId: string | null;
    spreadsheetIdMasked?: string | null;
    clientEmail: string | null;
    privateKeyProvided: boolean;
    tabsAllowRegex?: string | null;
    tabsDenyRegex?: string | null;
    dateFormat?: string | null;
  };
  connection:
    | { attempted: false; ok: false; error: string }
    | {
        attempted: true;
        ok: true;
        spreadsheet: { id: string; title: string | null };
        sheetTitles: string[];
      }
    | { attempted: true; ok: false; error: string };
};

type AttendanceSheetsStatusResponse = {
  enabled: boolean;
  dbToSheetsEnabled: boolean;
  spreadsheetId: string | null;
  spreadsheetIdMasked?: string | null;
  detectedTabs: string[];
  processedTabs: number;
  syncedLessons: number;
  syncedRecords: number;
  rosterAdded: number;
  rosterUpdated: number;
  spreadsheetRows: number;
  lastRunId: string | null;
  lastStatus: "SUCCESS" | "FAILED" | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
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
    direction: string;
    action: string;
    sheetTitle: string | null;
    message: string;
  }>;
};

type TabsResponse = {
  items: Array<{
    sheetTitle: string;
    groupName: string;
    subjectName: string;
    groupId: string | null;
    subjectId: string | null;
  }>;
};

type PreviewResponse = {
  sheetTitle: string;
  rows: string[][];
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function AttendanceSheetsView({
  lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = React.useState<string>("");
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  const syncMutation = useMutation({
    mutationFn: () => attendanceSheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "health"],
      });
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "tabs"],
      });
      if (selectedTab) {
        queryClient.invalidateQueries({
          queryKey: ["attendance-sheets", "preview", selectedTab],
        });
      }
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["attendance-sheets", "health"],
    queryFn: () =>
      attendanceSheetsApi
        .health()
        .then((r) => r.data.data as AttendanceSheetsHealthResponse),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["attendance-sheets", "status"],
    queryFn: () =>
      attendanceSheetsApi
        .status()
        .then((r) => r.data.data as AttendanceSheetsStatusResponse),
    refetchInterval: 15_000,
  });

  const { data: tabs } = useQuery({
    queryKey: ["attendance-sheets", "tabs"],
    queryFn: () =>
      attendanceSheetsApi.tabs().then((r) => r.data.data as TabsResponse),
    refetchInterval: 60_000,
  });

  React.useEffect(() => {
    if (spreadsheetIdDraft.trim()) return;
    const initial =
      status?.spreadsheetId ?? health?.config?.spreadsheetId ?? "";
    if (initial) setSpreadsheetIdDraft(initial);
  }, [
    status?.spreadsheetId,
    health?.config?.spreadsheetId,
    spreadsheetIdDraft,
  ]);

  const connectMutation = useMutation({
    mutationFn: (data: { spreadsheetId: string | null }) =>
      attendanceSheetsApi.patchConfig(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "health"],
      });
      queryClient.invalidateQueries({
        queryKey: ["attendance-sheets", "tabs"],
      });
    },
  });

  React.useEffect(() => {
    if (selectedTab) return;
    const first = tabs?.items?.[0]?.sheetTitle;
    if (first) setSelectedTab(first);
  }, [tabs, selectedTab]);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["attendance-sheets", "preview", selectedTab],
    queryFn: () =>
      selectedTab
        ? attendanceSheetsApi
            .preview({ sheetTitle: selectedTab, takeRows: 30 })
            .then((r) => r.data.data as PreviewResponse)
        : Promise.resolve({ sheetTitle: "", rows: [] } as PreviewResponse),
    enabled: Boolean(selectedTab),
    refetchInterval: 60_000,
  });

  const title = dict?.nav?.attendanceSheets ?? "Attendance Sheets";

  const previewRows = preview?.rows ?? [];
  const header = previewRows[0] ?? [];
  const bodyRows = previewRows.slice(1);

  return (
    <div className="container space-y-6 max-w-7xl mx-auto py-4">
      <PageHeader
        title={title}
        description={
          dict?.sheetsAttendance?.description ??
          "Teachers mark attendance in Google Sheets. This page manages sync and lets you preview tabs."
        }
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="font-semibold shadow-sm"
            >
              <RefreshCcw
                className={
                  "h-4 w-4 mr-2 " +
                  (syncMutation.isPending ? "animate-spin" : "")
                }
              />
              {syncMutation.isPending ? "Syncing..." : "Force Sync"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ["attendance-sheets", "status"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["attendance-sheets", "health"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["attendance-sheets", "tabs"],
                });
                if (selectedTab) {
                  queryClient.invalidateQueries({
                    queryKey: ["attendance-sheets", "preview", selectedTab],
                  });
                }
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-[520px] grid-cols-3 mb-4 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="h-fit">
              <CardHeader className="pb-3 border-b border-muted/30">
                <CardTitle className="text-xl">
                  {dict?.sheets?.connectionTitle ?? "Source Spreadsheet"}
                </CardTitle>
                <CardDescription>
                  Attendance (tabs = GROUP_SUBJECT)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {healthLoading ? (
                  <div>{dict?.common?.loading ?? "Loading..."}</div>
                ) : health ? (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">
                        {dict?.sheets?.spreadsheetIdLabel ?? "Spreadsheet ID"}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={spreadsheetIdDraft}
                          onChange={(e) =>
                            setSpreadsheetIdDraft(e.target.value)
                          }
                          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                          className="font-mono text-xs"
                        />
                        <Button
                          onClick={() =>
                            connectMutation.mutate({
                              spreadsheetId: spreadsheetIdDraft.trim()
                                ? spreadsheetIdDraft.trim()
                                : null,
                            })
                          }
                          disabled={connectMutation.isPending}
                        >
                          {connectMutation.isPending
                            ? "Connecting..."
                            : (dict?.common?.connect ?? "Connect")}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {health.config?.clientEmail
                          ? `Share the spreadsheet with ${health.config.clientEmail}`
                          : ""}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={health.config?.enabled ? "default" : "outline"}
                      >
                        {health.config?.enabled ? "Enabled" : "Disabled"}
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
                      <Badge
                        variant={
                          health.config?.workerEnabled ? "default" : "outline"
                        }
                      >
                        {health.config?.workerEnabled
                          ? "Auto Sync"
                          : "Manual Only"}
                      </Badge>
                    </div>

                    {health.connection.attempted && !health.connection.ok && (
                      <div className="text-[11px] text-destructive font-semibold mt-1">
                        Connection: {health.connection.error}
                      </div>
                    )}

                    {health.connection.attempted && health.connection.ok ? (
                      <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-muted mt-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Spreadsheet Title
                          </span>
                          <span className="font-semibold text-primary">
                            {health.connection.spreadsheet.title || "Untitled"}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Tabs detected (
                            {health.connection.sheetTitles.length})
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {health.connection.sheetTitles
                              .slice(0, 60)
                              .map((t) => (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 h-auto"
                                >
                                  {t}
                                </Badge>
                              ))}
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs uppercase font-bold tracking-tight mb-0.5">
                            Service Email
                          </span>
                          <span className="font-mono text-[10px] break-all opacity-70">
                            {health.config.clientEmail}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-muted/30">
                <CardTitle className="text-xl">Sync Status</CardTitle>
                <CardDescription>Last run and counters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {statusLoading ? (
                  <div>{dict?.common?.loading ?? "Loading..."}</div>
                ) : status ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={status.enabled ? "default" : "outline"}>
                        {status.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                      <Badge
                        variant={
                          status.lastStatus === "SUCCESS"
                            ? "secondary"
                            : status.lastStatus === "FAILED"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {status.lastStatus ?? "Never synced"}
                      </Badge>
                      {status.worker?.enabled && (
                        <Badge
                          variant={
                            status.worker.running ? "secondary" : "outline"
                          }
                        >
                          {status.worker.running
                            ? "Worker running"
                            : "Worker idle"}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Processed tabs
                        </div>
                        <div className="text-lg font-semibold">
                          {status.processedTabs ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Spreadsheet rows
                        </div>
                        <div className="text-lg font-semibold">
                          {status.spreadsheetRows ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Synced records
                        </div>
                        <div className="text-lg font-semibold">
                          {status.syncedRecords ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Roster changes
                        </div>
                        <div className="text-lg font-semibold">
                          +{status.rosterAdded ?? 0} / ~
                          {status.rosterUpdated ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Last sync
                        </div>
                        <div className="text-sm font-semibold text-primary">
                          {formatDateTime(status.lastSyncAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Last success
                        </div>
                        <div className="text-sm font-semibold text-primary">
                          {formatDateTime(status.lastSuccessAt)}
                        </div>
                      </div>
                    </div>

                    {status.lastError && (
                      <div className="text-xs text-destructive font-semibold break-words">
                        Error: {status.lastError}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 outline-none">
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
                  <Select value={selectedTab} onValueChange={setSelectedTab}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tab" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tabs?.items ?? []).map((t) => (
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
                <div className="text-sm text-muted-foreground">
                  No rows found
                </div>
              ) : (
                <div className="rounded-md border overflow-auto">
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
              )}

              <div className="text-xs text-muted-foreground">
                Preview shows up to 20 columns and 30 rows.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 outline-none">
          <Card>
            <CardHeader className="pb-3 border-b border-muted/30">
              <CardTitle className="text-xl">Logs</CardTitle>
              <CardDescription>Recent sync logs</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <SyncLogs logs={status?.recentLogs ?? []} dict={dict} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
