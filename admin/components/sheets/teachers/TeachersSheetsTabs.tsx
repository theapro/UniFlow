"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List } from "lucide-react";

import { teachersSheetsApi } from "@/lib/api";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { SyncLogs } from "@/components/sheets/SyncLogs";
import { SheetsTabsList } from "@/components/sheets/SheetsTabsList";

import { TeachersSheetsOverview } from "./TeachersSheetsOverview";

export function TeachersSheetsTabs({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["teachers-sheets", "health"],
    queryFn: () => teachersSheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["teachers-sheets", "status"],
    queryFn: () => teachersSheetsApi.status().then((r) => r.data.data as any),
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

  return (
    <Tabs defaultValue="overview" className="w-full">
      <SheetsTabsList columns={2} className="mb-4">
        <TabsTrigger value="overview" className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="logs" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          Logs
        </TabsTrigger>
      </SheetsTabsList>

      <TabsContent value="overview" className="space-y-6 outline-none">
        <TeachersSheetsOverview
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

      <TabsContent value="logs" className="space-y-6 outline-none">
        <SyncLogs
          logs={status?.recentLogs ?? []}
          dict={dict}
          description="Latest sync logs (DB)"
          showCard={true}
        />
      </TabsContent>
    </Tabs>
  );
}
