"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gradesSheetsApi } from "@/lib/api";
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
import { RefreshCcw, Table as TableIcon, LayoutGrid, List } from "lucide-react";

// Shape matches backend AdminGradesSheetsController responses

type GradesSheetsHealthResponse = {
  config: {
    enabled: boolean;
    spreadsheetId: string | null;
    spreadsheetIdMasked?: string | null;
    clientEmail: string | null;
    privateKeyProvided: boolean;
    tabsAllowRegex?: string | null;
    tabsDenyRegex?: string | null;
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

type GradesSheetsStatusResponse = {
  enabled: boolean;
  spreadsheetId: string | null;
  spreadsheetIdMasked?: string | null;
  detectedTabs: string[];
  processedTabs: number;
  spreadsheetRows: number;
  rosterAdded: number;
  rosterUpdated: number;
  lastRunId: string | null;
  lastStatus: "SUCCESS" | "FAILED" | null;
  lastSyncAt: string | null;
  lastError: string | null;
  errors: Array<{ sheetTitle: string; message: string }>;
};

type TabsResponse = {
  items: Array<{ sheetTitle: string; groupName: string; subjectName: string }>;
};

type PreviewResponse = {
  sheetTitle: string;
  rows: string[][];
};

export function GradesSheetsView({ dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = React.useState<string>("");
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  const syncMutation = useMutation({
    mutationFn: () => gradesSheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "tabs"] });
      if (selectedTab) {
        queryClient.invalidateQueries({
          queryKey: ["grades-sheets", "preview", selectedTab],
        });
      }
    },
  });

  const forceSyncMutation = useMutation({
    mutationFn: () => gradesSheetsApi.forceSyncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "tabs"] });
      if (selectedTab) {
        queryClient.invalidateQueries({
          queryKey: ["grades-sheets", "preview", selectedTab],
        });
      }
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["grades-sheets", "health"],
    queryFn: () =>
      gradesSheetsApi
        .health()
        .then((r) => r.data.data as GradesSheetsHealthResponse),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["grades-sheets", "status"],
    queryFn: () =>
      gradesSheetsApi
        .status()
        .then((r) => r.data.data as GradesSheetsStatusResponse),
    refetchInterval: 15_000,
  });

  const { data: tabs } = useQuery({
    queryKey: ["grades-sheets", "tabs"],
    queryFn: () =>
      gradesSheetsApi.tabs().then((r) => r.data.data as TabsResponse),
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
      gradesSheetsApi.patchConfig(data).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "tabs"] });
      if (selectedTab) {
        queryClient.invalidateQueries({
          queryKey: ["grades-sheets", "preview", selectedTab],
        });
      }
    },
  });

  React.useEffect(() => {
    if (selectedTab) return;
    const first = tabs?.items?.[0]?.sheetTitle;
    if (first) setSelectedTab(first);
  }, [tabs, selectedTab]);

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["grades-sheets", "preview", selectedTab],
    queryFn: () =>
      selectedTab
        ? gradesSheetsApi
            .preview({ sheetTitle: selectedTab, takeRows: 30 })
            .then((r) => r.data.data as PreviewResponse)
        : Promise.resolve({ sheetTitle: "", rows: [] } as PreviewResponse),
    enabled: Boolean(selectedTab),
    refetchInterval: 60_000,
  });

  const title = dict?.nav?.gradesSheets ?? "Grades Sheets";

  const previewRows = preview?.rows ?? [];
  const header = previewRows[0] ?? [];
  const bodyRows = previewRows.slice(1);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={title}
        description={
          dict?.sheetsGrades?.description ??
          "Manage synchronization and preview the Grades (Baholash) spreadsheet."
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="font-semibold"
            >
              <RefreshCcw
                className={
                  "h-4 w-4 mr-2 " +
                  (syncMutation.isPending ? "animate-spin" : "")
                }
              />
              {syncMutation.isPending ? "Syncing..." : "Sync"}
            </Button>
            <Button
              onClick={() => forceSyncMutation.mutate()}
              disabled={forceSyncMutation.isPending}
              className="font-semibold shadow-sm"
            >
              <RefreshCcw
                className={
                  "h-4 w-4 mr-2 " +
                  (forceSyncMutation.isPending ? "animate-spin" : "")
                }
              />
              {forceSyncMutation.isPending ? "Syncing..." : "Force Sync"}
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Errors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="h-fit">
              <CardHeader className="pb-3 border-b border-muted/30">
                <CardTitle className="text-xl">
                  {dict?.sheets?.connectionTitle ?? "Source Spreadsheet"}
                </CardTitle>
                <CardDescription>Grades (tabs = GROUP_SUBJECT)</CardDescription>
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
                    </div>

                    {health.connection.attempted && !health.connection.ok && (
                      <div className="text-[11px] text-destructive font-semibold">
                        Connection: {health.connection.error}
                      </div>
                    )}

                    {health.connection.attempted && health.connection.ok ? (
                      <div className="space-y-3 bg-muted/30 p-3 rounded-lg border border-muted">
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
                            Tabs detected
                          </span>
                          <span className="font-semibold">
                            {(health.connection.sheetTitles ?? []).length}
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

            <Card className="h-fit">
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
                        {status.lastStatus ?? "Never"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Tabs detected
                        </div>
                        <div className="text-lg font-semibold">
                          {(status.detectedTabs ?? []).length}
                        </div>
                      </div>
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
                          Roster added
                        </div>
                        <div className="text-lg font-semibold">
                          {status.rosterAdded ?? 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold text-muted-foreground">
                          Roster updated
                        </div>
                        <div className="text-lg font-semibold">
                          {status.rosterUpdated ?? 0}
                        </div>
                      </div>
                    </div>

                    {status.lastSyncAt ? (
                      <div className="text-xs text-muted-foreground">
                        Last sync:{" "}
                        {new Date(status.lastSyncAt).toLocaleString()}
                      </div>
                    ) : null}

                    {status.lastError ? (
                      <div className="text-xs text-destructive font-semibold">
                        {status.lastError}
                      </div>
                    ) : null}
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
              <CardTitle className="text-xl">Preview</CardTitle>
              <CardDescription>
                Select a tab to preview the first rows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-[360px] max-w-full">
                  <Select
                    value={selectedTab}
                    onValueChange={(v) => setSelectedTab(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tab" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tabs?.items ?? []).map((t) => (
                        <SelectItem key={t.sheetTitle} value={t.sheetTitle}>
                          {t.groupName} / {t.subjectName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {previewLoading ? (
                <div>{dict?.common?.loading ?? "Loading..."}</div>
              ) : previewRows.length ? (
                <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {header.map((h, idx) => (
                            <TableHead key={idx} className="whitespace-nowrap">
                              {h || "-"}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bodyRows.map((r, ridx) => (
                          <TableRow key={ridx}>
                            {header.map((_, cidx) => (
                              <TableCell
                                key={cidx}
                                className="whitespace-nowrap"
                              >
                                {String(r?.[cidx] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No data</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4 outline-none">
          <Card>
            <CardHeader className="pb-3 border-b border-muted/30">
              <CardTitle className="text-xl">Errors</CardTitle>
              <CardDescription>Most recent sync errors</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {(status?.errors ?? []).length ? (
                <div className="space-y-2">
                  {(status?.errors ?? []).map((e, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <div className="text-xs font-mono text-muted-foreground break-all">
                        {e.sheetTitle}
                      </div>
                      <div className="text-sm text-destructive font-semibold">
                        {e.message}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No errors</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
