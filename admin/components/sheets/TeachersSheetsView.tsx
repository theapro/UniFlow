"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { teachersSheetsApi } from "@/lib/api";
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
import { RefreshCcw, LayoutGrid, List } from "lucide-react";
import { SyncLogs } from "./SyncLogs";

type TeachersSheetsStatusResponse = {
  enabled: boolean;
  spreadsheetId: string | null;
  spreadsheetIdMasked?: string | null;
  detectedSubjects: string[];
  syncedTeachers: number;
  spreadsheetRows: number;
  lastRunId: string | null;
  lastStatus: "SUCCESS" | "FAILED" | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  recentLogs: Array<{
    createdAt: string;
    level: "INFO" | "WARN" | "ERROR";
    direction: string;
    action: string;
    sheetTitle: string | null;
    teacherId: string | null;
    message: string;
  }>;
};

type TeachersSheetsHealthResponse = {
  config: {
    enabled: boolean;
    spreadsheetId: string | null;
    spreadsheetIdMasked?: string | null;
    clientEmail: string | null;
    privateKeyProvided: boolean;
    subjectTabsAllowRegex?: string | null;
    subjectTabsDenyRegex?: string | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function TeachersSheetsView({
  lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  const queryClient = useQueryClient();
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  const syncMutation = useMutation({
    mutationFn: () => teachersSheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "health"],
      });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["teachers-sheets", "health"],
    queryFn: () =>
      teachersSheetsApi
        .health()
        .then((r) => r.data.data as TeachersSheetsHealthResponse),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["teachers-sheets", "status"],
    queryFn: () =>
      teachersSheetsApi
        .status()
        .then((r) => r.data.data as TeachersSheetsStatusResponse),
    refetchInterval: 15_000,
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
      teachersSheetsApi.patchConfig(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "health"],
      });
    },
  });

  const title = dict?.nav?.teachersSheets ?? "Teachers Sheets";

  return (
    <div className="container space-y-6 max-w-7xl mx-auto py-4">
      <PageHeader
        title={title}
        description={
          dict?.sheetsTeachers?.description ??
          "Manage synchronization between TeachersWithSubjects Google Sheet and Database."
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
                  queryKey: ["teachers-sheets", "status"],
                });
                queryClient.invalidateQueries({
                  queryKey: ["teachers-sheets", "health"],
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
                  TeachersWithSubjects (tabs = subjects)
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
                        className="animate-in fade-in zoom-in duration-300"
                      >
                        {(health.connection as any)?.attempted
                          ? (health.connection as any)?.ok
                            ? "Connected"
                            : "Error"
                          : "Not configured"}
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
                            Detected Subject tabs (
                            {health.connection.sheetTitles.length})
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                            {health.connection.sheetTitles.map((t) => (
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Synced teachers
                        </div>
                        <div className="text-lg font-semibold">
                          {status.syncedTeachers ?? 0}
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
                          Subjects detected
                        </div>
                        <div className="text-lg font-semibold">
                          {(status.detectedSubjects ?? []).length}
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
                    </div>

                    {status.lastError ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                        <div className="flex items-center gap-2 font-semibold text-destructive mb-1">
                          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                          Last sync error
                        </div>
                        <div className="text-muted-foreground break-all font-mono text-xs bg-background/50 p-2 rounded border border-destructive/20">
                          {status.lastError}
                        </div>
                      </div>
                    ) : null}

                    {health &&
                    health.connection.attempted &&
                    !health.connection.ok ? (
                      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
                        <div className="flex items-center gap-2 font-semibold text-yellow-600 dark:text-yellow-400 mb-1">
                          Connection Error
                        </div>
                        <div className="text-muted-foreground break-all font-mono text-xs">
                          {health.connection.error}
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Check your service account permissions and spreadsheet
                          share settings.
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2 pt-2 border-t border-muted/30">
                      <div className="text-xs uppercase font-bold text-muted-foreground">
                        Detected Subject Tabs
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(status.detectedSubjects ?? []).length ? (
                          status.detectedSubjects.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="bg-background/50"
                            >
                              {s}
                            </Badge>
                          ))
                        ) : health?.connection.attempted &&
                          health.connection.ok ? (
                          health.connection.sheetTitles.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="opacity-50"
                            >
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
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
              <CardDescription>Latest sync logs (DB)</CardDescription>
            </CardHeader>
            <CardContent>
              <SyncLogs logs={status?.recentLogs ?? []} dict={dict} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
