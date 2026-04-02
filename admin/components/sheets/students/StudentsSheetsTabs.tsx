"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LayoutGrid, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

import { sheetsApi } from "@/lib/api";
import { Tabs, TabsContent, TabsTrigger, TabsList } from "@/components/ui/tabs";

import { ConflictManager } from "@/components/sheets/ConflictManager";
import { SyncLogs } from "@/components/sheets/SyncLogs";
import { StudentsSheetsOverview } from "./StudentsSheetsOverview";

export function StudentsSheetsTabs({ dict }: { dict: any }) {
  const queryClient = useQueryClient();
  const [selectedConflictId, setSelectedConflictId] = React.useState<
    string | null
  >(null);
  const [spreadsheetIdDraft, setSpreadsheetIdDraft] = React.useState("");

  // --- Queries ---
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["sheets", "health"],
    queryFn: () => sheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["sheets", "status"],
    queryFn: () => sheetsApi.status().then((r) => r.data.data as any),
    refetchInterval: 15_000,
  });

  const { data: groupsStatus } = useQuery({
    queryKey: ["sheets", "groups", "status"],
    queryFn: () => sheetsApi.groups.status().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const { data: conflicts } = useQuery({
    queryKey: ["sheets", "conflicts", "open"],
    queryFn: () =>
      sheetsApi.conflicts
        .list({ status: "OPEN", take: 25 })
        .then((r) => r.data.data),
    refetchInterval: 15_000,
  });

  const { data: conflictDetail } = useQuery({
    queryKey: ["sheets", "conflicts", selectedConflictId],
    queryFn: () =>
      selectedConflictId
        ? sheetsApi.conflicts
            .getById(selectedConflictId)
            .then((r) => r.data.data)
        : null,
    enabled: Boolean(selectedConflictId),
  });

  // --- Mutations ---
  const connectMutation = useMutation({
    mutationFn: (data: { spreadsheetId: string | null }) =>
      sheetsApi.patchConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
    },
  });

  const syncGroupsMutation = useMutation({
    mutationFn: () => sheetsApi.groups.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (data: any) =>
      selectedConflictId
        ? sheetsApi.conflicts.resolve(selectedConflictId, data)
        : Promise.reject(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets"] });
      setSelectedConflictId(null);
    },
  });

  // Spreadsheet ID sinxronizatsiyasi
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

  const openConflictsCount =
    status?.openConflicts ?? conflicts?.items?.length ?? 0;

  return (
    <Tabs defaultValue="overview" className="w-full space-y-10">
      {/* 1. TABS HEADER: Minimalist Center-aligned Bar */}
      <div className="flex w-full">
        <TabsList className="h-10 inline-flex items-center justify-center p-1 bg-zinc-100/50 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200/50 dark:border-white/5 rounded-full shadow-inner">
          <TabsTrigger
            value="overview"
            className="h-8 px-6 rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-950 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 gap-2 font-bold text-[13px]"
          >
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>

          <TabsTrigger
            value="conflicts"
            className="h-8 px-6 rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-950 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 gap-2 font-bold text-[13px]"
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                openConflictsCount > 0 ? "text-orange-500" : "text-zinc-400",
              )}
            />
            Conflicts
            {openConflictsCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white ml-1 animate-in zoom-in">
                {openConflictsCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="logs"
            className="h-8 px-6 rounded-full data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-950 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-200 gap-2 font-bold text-[13px]"
          >
            <Terminal className="h-4 w-4" />
            Terminal
          </TabsTrigger>
        </TabsList>
      </div>

      {/* 2. CONTENT SECTIONS */}
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
        <TabsContent
          value="overview"
          className="mt-0 outline-none focus-visible:ring-0"
        >
          <StudentsSheetsOverview
            dict={dict}
            healthLoading={healthLoading}
            health={health}
            statusLoading={statusLoading}
            status={status}
            groupsStatus={groupsStatus}
            onSyncGroups={() => syncGroupsMutation.mutate()}
            isSyncingGroups={syncGroupsMutation.isPending}
            spreadsheetIdDraft={spreadsheetIdDraft}
            onSpreadsheetIdDraftChange={setSpreadsheetIdDraft}
            onConnect={() =>
              connectMutation.mutate({
                spreadsheetId: spreadsheetIdDraft.trim() || null,
              })
            }
            isConnecting={connectMutation.isPending}
            openConflicts={openConflictsCount}
          />
        </TabsContent>

        <TabsContent
          value="conflicts"
          className="mt-0 outline-none focus-visible:ring-0"
        >
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

        <TabsContent
          value="logs"
          className="mt-0 outline-none focus-visible:ring-0"
        >
          <SyncLogs
            logs={status?.recentLogs ?? []}
            dict={dict}
            title="System Trace"
            description="Real-time synchronization activity"
            showCard={true}
            className="rounded-[34px]"
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
