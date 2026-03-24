"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";

import { gradesSheetsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function GradesSheetsActions({ dict }: { dict: any }) {
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["grades-sheets", "health"],
    queryFn: () => gradesSheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: () => gradesSheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "tabs"] });
    },
  });

  const forceSyncMutation = useMutation({
    mutationFn: () => gradesSheetsApi.forceSyncNow().then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "tabs"] });
    },
  });

  const autoSyncMutation = useMutation({
    mutationFn: (workerEnabled: boolean) =>
      gradesSheetsApi.patchConfig({ workerEnabled }).then((r) => r.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "status"] });
      queryClient.invalidateQueries({ queryKey: ["grades-sheets", "health"] });
    },
  });

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
        <span className="text-sm font-medium">Auto Sync</span>
        <Switch
          checked={Boolean(health?.config?.workerEnabled)}
          onCheckedChange={(checked) => autoSyncMutation.mutate(checked)}
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
