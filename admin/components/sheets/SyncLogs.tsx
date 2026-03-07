"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type Log = {
  createdAt: string;
  level: "INFO" | "WARN" | "ERROR";
  direction: string;
  action: string;
  sheetTitle: string | null;
  message: string;
};

interface SyncLogsProps {
  logs: Log[];
  dict: any;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SyncLogs({ logs, dict }: SyncLogsProps) {
  // Requirement: newest should be at the bottom (chronological order)
  // Assuming logs are returned from API with newest first, we reverse them
  const sortedLogs = [...logs].reverse();

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {dict?.sheets?.lastLogsTitle ?? "Synchronization Logs"}
      </div>
      <ScrollArea className="h-[400px] w-full rounded-md border p-4 bg-slate-950 text-slate-50">
        <div className="space-y-1 font-mono text-xs">
          {sortedLogs.length > 0 ? (
            sortedLogs.map((l, idx) => (
              <div
                key={idx}
                className="flex gap-2 items-start py-0.5 border-b border-slate-800 last:border-0 hover:bg-slate-900"
              >
                <span className="text-slate-500 shrink-0">
                  [{formatDateTime(l.createdAt)}]
                </span>
                <span
                  className={`shrink-0 font-bold ${
                    l.level === "ERROR"
                      ? "text-red-400"
                      : l.level === "WARN"
                        ? "text-yellow-400"
                        : "text-emerald-400"
                  }`}
                >
                  {l.level}
                </span>
                <span className="text-blue-300 shrink-0">
                  {l.direction.replace(/_/g, " ")}
                </span>
                <span className="flex-1 break-all">{l.message}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic text-center py-4">
              {dict?.sheets?.noLogs ?? "No logs available"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
