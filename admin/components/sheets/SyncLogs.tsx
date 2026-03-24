"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Terminal, Clock, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type SyncLog = {
  createdAt: string;
  level: "INFO" | "WARN" | "ERROR";
  direction: string;
  action: string;
  sheetTitle: string | null;
  message: string;
};

interface SyncLogsProps {
  logs: SyncLog[];
  dict: any;
  title?: string;
  description?: string;
  className?: string;
  showCard?: boolean;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function SyncLogsContent({ logs, dict }: { logs: SyncLog[]; dict: any }) {
  const sortedLogs = [...logs].reverse();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <div className="flex flex-col space-y-4">
      {/* Terminal oynasi: Minimalist Glassmorphism */}
      <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-zinc-950/40 backdrop-blur-md">
        {/* Yuqori nafis chiziq */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <ScrollArea ref={scrollRef} className="h-[450px] w-full">
          <div className="p-6 font-mono text-[11px] leading-relaxed selection:bg-primary/20">
            {sortedLogs.length > 0 ? (
              <div className="space-y-2">
                {sortedLogs.map((l, idx) => (
                  <div
                    key={idx}
                    className="flex gap-4 items-start group/line transition-all duration-300 hover:bg-white/[0.03] rounded-lg px-2 -mx-2 py-1"
                  >
                    <span className="text-zinc-600 shrink-0 select-none font-medium flex items-center gap-2">
                      <span className="size-1 rounded-full bg-zinc-800 group-hover/line:bg-primary/50 transition-colors" />
                      {formatDateTime(l.createdAt)}
                    </span>

                    <span
                      className={cn(
                        "shrink-0 font-bold px-2 py-0.5 rounded-full text-[8px] tracking-tight border",
                        l.level === "ERROR"
                          ? "bg-red-500/5 text-red-400 border-red-500/10"
                          : l.level === "WARN"
                            ? "bg-orange-500/5 text-orange-400 border-orange-500/10"
                            : "bg-emerald-500/5 text-emerald-400 border-emerald-500/10",
                      )}
                    >
                      {l.level}
                    </span>

                    <span className="flex-1 text-zinc-400 group-hover/line:text-zinc-200 transition-colors">
                      <span className="text-zinc-600 mr-2">/</span>
                      {l.message}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[380px] text-zinc-700 space-y-3">
                <div className="p-4 rounded-full bg-zinc-900/50 border border-white/5">
                    <AlertCircle className="size-5 opacity-20" />
                </div>
                <p className="text-[10px] tracking-[0.2em] uppercase font-semibold">
                  {dict?.sheets?.noLogs ?? "System Idle"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer: Silliq va toza */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-emerald-500/80 " />
          <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Live Trace</span>
        </div>
        <div className="text-[9px] font-medium text-zinc-600 uppercase tracking-tighter">
          Buffer {logs.length} units • Stable
        </div>
      </div>
    </div>
  );
}

export function SyncLogs({
  logs,
  dict,
  title = "Activity",
  description = "System logs",
  showCard = false,
  className,
}: SyncLogsProps) {
  if (showCard) {
    return (
      <Card className={cn("rounded-[34px] border-white/5 bg-zinc-900/20 backdrop-blur-xl shadow-none", className)}>
        <CardHeader className="pb-4 px-8 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-white">{title}</CardTitle>
              <CardDescription className="text-xs text-zinc-500">{description}</CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full border-white/10 text-[9px] px-3 bg-white/5">
                {logs.length} EVENTS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          <SyncLogsContent logs={logs} dict={dict} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <SyncLogsContent logs={logs} dict={dict} />
    </div>
  );
}