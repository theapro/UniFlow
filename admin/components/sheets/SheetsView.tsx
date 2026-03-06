"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function fieldList() {
  return [
    "student_uuid",
    "student_number",
    "fullname",
    "email",
    "phone",
    "status",
    "teacher_ids",
    "parent_ids",
    "cohort",
    "created_at",
    "updated_at",
    "note",
    "group",
  ] as const;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function SheetsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();
  const [selectedConflictId, setSelectedConflictId] = React.useState<
    string | null
  >(null);
  const [mergePayload, setMergePayload] = React.useState<any | null>(null);

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
      setMergePayload(null);
    },
  });

  const title = dict?.nav?.sheets ?? "Sheets";

  return (
    <div className="container space-y-4">
      <PageHeader
        title={title}
        description={
          dict?.sheets?.description ??
          "Students Spreadsheet sync (Google Sheets -> DB)."
        }
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {dict?.sheets?.connectionTitle ?? "Students Spreadsheet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                      ? "Worker enabled"
                      : "Worker disabled"}
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
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Spreadsheet ID:
                      </span>{" "}
                      <span className="font-medium">
                        {health.connection.spreadsheet.id ??
                          health.config?.spreadsheetId ??
                          "—"}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Spreadsheet:
                      </span>{" "}
                      <span className="font-medium">
                        {health.connection.spreadsheet.title ?? "(untitled)"}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Detected groups (tabs):
                      </span>{" "}
                      <span className="font-medium">
                        {health.connection.sheetTitles.length}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {health.connection.sheetTitles.join(", ") || "—"}
                    </div>
                  </div>
                ) : health.connection.attempted && !health.connection.ok ? (
                  <div className="text-sm text-destructive">
                    {health.connection.error}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {health.connection.error}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {dict?.sheets?.queueTitle ?? "Synchronization"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <div>{dict?.common?.loading ?? "Loading..."}</div>
            ) : status ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      status.lastStatus === "SUCCESS"
                        ? "secondary"
                        : status.lastStatus === "FAILED"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {status.lastStatus ?? "No sync yet"}
                  </Badge>
                  <Badge
                    variant={status.dbToSheetsEnabled ? "default" : "outline"}
                  >
                    {status.dbToSheetsEnabled
                      ? "DB->Sheets enabled"
                      : "DB->Sheets disabled"}
                  </Badge>
                  <Badge variant={status.detectDeletes ? "default" : "outline"}>
                    {status.detectDeletes
                      ? "Detect deletes"
                      : "No delete detect"}
                  </Badge>
                  <Badge
                    variant={status.worker?.running ? "secondary" : "outline"}
                  >
                    {status.worker?.running
                      ? "Worker running"
                      : "Worker stopped"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Students in DB
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {status.syncedStudents}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Rows in Sheets
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {status.spreadsheetRows}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Open conflicts
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {status.openConflicts ?? conflicts?.items?.length ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Spreadsheet ID
                    </div>
                    <div className="text-sm font-medium break-all">
                      {status.spreadsheetId ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Detected groups
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {status.detectedGroups.length}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">
                      Last run
                    </div>
                    <div className="text-sm font-medium">
                      {status.lastRunId ? status.lastRunId.slice(0, 8) : "—"}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Last sync: {formatDateTime(status.lastSyncAt)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Worker heartbeat:{" "}
                  {formatDateTime(status.worker?.lastHeartbeatAt)}
                </div>
                {status.lastError ? (
                  <div className="text-sm text-destructive">
                    {status.lastError}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="text-sm font-medium">Last sync logs</div>
                  <div className="space-y-1">
                    {(status.recentLogs ?? []).slice(0, 10).map((l, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {formatDateTime(l.createdAt)}
                        </span>{" "}
                        <span>{l.level}</span> <span>{l.direction}</span>{" "}
                        <span>{l.message}</span>
                      </div>
                    ))}
                    {status.recentLogs?.length ? null : (
                      <div className="text-xs text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(conflicts?.items ?? []).length ? (
              <div className="space-y-2">
                {(conflicts?.items ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedConflictId(c.id);
                      setMergePayload(null);
                    }}
                    className={
                      "w-full rounded-md border p-3 text-left hover:bg-muted/50 " +
                      (selectedConflictId === c.id ? "border-primary" : "")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {c.studentId ? c.studentId.slice(0, 8) : "(no uuid)"} —{" "}
                        {c.sheetTitle ?? "(unknown tab)"}
                      </div>
                      <Badge variant="destructive">OPEN</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(c.detectedAt)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.message ?? "Conflict detected"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No open conflicts
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conflict Resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!conflictDetail ? (
              <div className="text-sm text-muted-foreground">
                Select a conflict to view details.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      conflictDetail.status === "OPEN"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {conflictDetail.status}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {conflictDetail.sheetTitle ?? "(unknown tab)"} row{" "}
                    {conflictDetail.rowNumber ?? "—"}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="font-medium">Field</div>
                  <div className="font-medium">Sheet</div>
                  <div className="font-medium">DB</div>
                  {fieldList().map((f) => {
                    const s = safeStr(conflictDetail.sheetPayload?.[f]);
                    const d = safeStr(conflictDetail.dbPayload?.[f]);
                    const different = s !== d;
                    return (
                      <React.Fragment key={f}>
                        <div className="text-muted-foreground">{f}</div>
                        <div
                          className={
                            different
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {s || "—"}
                        </div>
                        <div
                          className={
                            different
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }
                        >
                          {d || "—"}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      resolveMutation.mutate({ resolution: "KEEP_SHEET" })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    Keep Sheet
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({ resolution: "KEEP_DB" })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    Keep DB
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const base =
                        conflictDetail.sheetPayload ??
                        conflictDetail.dbPayload ??
                        {};
                      setMergePayload({ ...base });
                    }}
                    disabled={resolveMutation.isPending}
                  >
                    Merge
                  </Button>
                </div>

                {mergePayload ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="text-sm font-medium">Merge payload</div>
                    <div className="grid grid-cols-2 gap-2">
                      {fieldList()
                        .filter((f) => f !== "student_uuid")
                        .map((f) => (
                          <div key={f} className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {f}
                            </div>
                            <Input
                              value={safeStr(mergePayload[f])}
                              onChange={(e) =>
                                setMergePayload((p: any) => ({
                                  ...(p ?? {}),
                                  [f]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          resolveMutation.mutate({
                            resolution: "MERGE",
                            mergedPayload: mergePayload,
                          })
                        }
                        disabled={resolveMutation.isPending}
                      >
                        Apply Merge
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setMergePayload(null)}
                        disabled={resolveMutation.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
