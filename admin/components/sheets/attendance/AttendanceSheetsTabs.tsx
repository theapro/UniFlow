"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Table as TableIcon } from "lucide-react";

import { attendanceSheetsApi } from "@/lib/api";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";

import { SyncLogs } from "@/components/sheets/SyncLogs";
import { SheetsTabsList } from "@/components/sheets/SheetsTabsList";

import { AttendanceSheetsOverview } from "./AttendanceSheetsOverview";
import { AttendanceSheetsPreview } from "./AttendanceSheetsPreview";

export function AttendanceSheetsTabs({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = React.useState<string>("");
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["attendance-sheets", "health"],
    queryFn: () => attendanceSheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["attendance-sheets", "status"],
    queryFn: () => attendanceSheetsApi.status().then((r) => r.data.data as any),
    refetchInterval: 15_000,
  });

  const { data: tabs } = useQuery({
    queryKey: ["attendance-sheets", "tabs"],
    queryFn: () => attendanceSheetsApi.tabs().then((r) => r.data.data as any),
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

  React.useEffect(() => {
    if (selectedTab) return;
    const first = tabs?.items?.[0]?.sheetTitle;
    if (first) setSelectedTab(first);
  }, [tabs, selectedTab]);

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

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["attendance-sheets", "preview", selectedTab],
    queryFn: () =>
      selectedTab
        ? attendanceSheetsApi
            .preview({ sheetTitle: selectedTab, takeRows: 30 })
            .then((r) => r.data.data as any)
        : Promise.resolve({ sheetTitle: "", rows: [] } as any),
    enabled: Boolean(selectedTab),
    refetchInterval: 60_000,
  });

  return (
    <Tabs defaultValue="overview" className="w-full">
      <SheetsTabsList columns={3} className="mb-4">
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
      </SheetsTabsList>

      <TabsContent value="overview" className="space-y-6 outline-none">
        <AttendanceSheetsOverview
          dict={dict}
          healthLoading={healthLoading}
          health={health}
          statusLoading={statusLoading}
          status={status}
          spreadsheetIdDraft={spreadsheetIdDraft}
          onSpreadsheetIdDraftChange={setSpreadsheetIdDraft}
          onConnect={() =>
            connectMutation.mutate({
              spreadsheetId: spreadsheetIdDraft.trim()
                ? spreadsheetIdDraft.trim()
                : null,
            })
          }
          isConnecting={connectMutation.isPending}
        />
      </TabsContent>

      <TabsContent value="preview" className="space-y-4 outline-none">
        <AttendanceSheetsPreview
          tabs={tabs}
          selectedTab={selectedTab}
          onSelectedTabChange={setSelectedTab}
          previewLoading={previewLoading}
          preview={preview}
        />
      </TabsContent>

      <TabsContent value="logs" className="space-y-4 outline-none">
        <SyncLogs logs={status?.recentLogs ?? []} dict={dict} showCard={true} />
      </TabsContent>
    </Tabs>
  );
}
