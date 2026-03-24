"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import { sheetsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function StudentsSheetsActions({ dict }: { dict: any }) {
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["sheets", "health"],
    queryFn: () => sheetsApi.health().then((r) => r.data.data as any),
    refetchInterval: 60_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sheets", "status"] });
    queryClient.invalidateQueries({ queryKey: ["sheets", "health"] });
  };

  const syncMutation = useMutation({
    mutationFn: () => sheetsApi.syncNow().then((r) => r.data.data),
    onSuccess: invalidateAll,
  });

  const forceSyncMutation = useMutation({
    mutationFn: () => sheetsApi.forceSyncNow().then((r) => r.data.data),
    onSuccess: invalidateAll,
  });

  const autoSyncMutation = useMutation({
    mutationFn: (workerEnabled: boolean) =>
      sheetsApi.patchConfig({ workerEnabled }).then((r) => r.data.data),
    onSuccess: invalidateAll,
  });

  const isAnySyncing = syncMutation.isPending || forceSyncMutation.isPending;

  return (
    <div className="flex items-center gap-3">
      {/* 1. AUTO SYNC TOGGLE */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-zinc-100/40 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/[0.05]">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
          Auto
        </span>
        <Switch
          checked={Boolean(health?.config?.workerEnabled)}
          onCheckedChange={(checked) => autoSyncMutation.mutate(checked)}
          disabled={healthLoading || autoSyncMutation.isPending}
          className="data-[state=checked]:bg-emerald-500/80 scale-90"
        />
      </div>

      {/* 2. SYNC BUTTON (GHOST) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => syncMutation.mutate()}
        disabled={isAnySyncing}
        className="h-10 rounded-full px-5 font-bold text-[11px] uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-white/5 bg-zinc-900/40 transition-all active:scale-95"
      >
        <RefreshCcw
          className={cn(
            "h-3.5 w-3.5 mr-2 text-zinc-500",
            syncMutation.isPending && "animate-spin text-primary"
          )}
        />
        {syncMutation.isPending ? "Process..." : "Sync"}
      </Button>

      {/* 3. FORCE RE-SYNC (MINIMALIST DARK) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => forceSyncMutation.mutate()}
        disabled={isAnySyncing}
        className={cn(
          "h-10 rounded-full px-5 font-bold text-[11px] uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-white/5 bg-zinc-900/40 transition-all active:scale-95"
        )}
      >
        <Zap
          className={cn(
            "h-3.5 w-3.5 mr-2",
            forceSyncMutation.isPending ? "animate-pulse text-yellow-500" : "text-zinc-500 group-hover:text-primary"
          )}
        />
        {forceSyncMutation.isPending ? "Re-syncing..." : "Force Re-sync"}
      </Button>
    </div>
  );
}   