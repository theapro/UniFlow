"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";

import { teachersSheetsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function TeachersSheetsActions({ dict }: { dict: any }) {
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["teachers-sheets", "health"],
    queryFn: () => teachersSheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

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

  const forceSyncMutation = useMutation({
    mutationFn: () => teachersSheetsApi.forceSyncNow().then((r) => r.data.data),
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

  const autoSyncMutation = useMutation({
    mutationFn: (workerEnabled: boolean) =>
      teachersSheetsApi.patchConfig({ workerEnabled }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "status"],
      });
      queryClient.invalidateQueries({
        queryKey: ["teachers-sheets", "health"],
      });
    },
  });

  const [autoSyncChecked, setAutoSyncChecked] = useState(false);
  useEffect(() => {
    if (healthLoading) return;
    if (autoSyncMutation.isPending) return;
    setAutoSyncChecked(Boolean(health?.config?.workerEnabled));
  }, [
    healthLoading,
    health?.config?.workerEnabled,
    autoSyncMutation.isPending,
  ]);

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
        <span className="text-sm font-medium">Auto Sync</span>
        <Switch
          checked={autoSyncChecked}
          onCheckedChange={(checked) => {
            const prev = autoSyncChecked;
            setAutoSyncChecked(checked);
            autoSyncMutation.mutate(checked, {
              onError: () => setAutoSyncChecked(prev),
            });
          }}
          disabled={healthLoading || autoSyncMutation.isPending}
        />
      </div>
      <Button
        variant="outline"
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        className="font-semibold"
      >
        <RefreshCcw
          className={
            "h-4 w-4 mr-2 " + (syncMutation.isPending ? "animate-spin" : "")
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
    </>
  );
}
