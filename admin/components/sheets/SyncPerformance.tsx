"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

type MetricTone = "default" | "warning";

export type SyncPerformanceMetric = {
  label: string;
  value: React.ReactNode;
  tone?: MetricTone;
};

export type SyncPerformanceRow = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
};

type SyncPerformanceProps = {
  title?: string;
  description?: string;
  status?: "SUCCESS" | "FAILED" | string | null;
  loading: boolean;
  metrics: SyncPerformanceMetric[];
  rows: SyncPerformanceRow[];
  error?: string | null;
  emptyText?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SyncPerformance({
  title = "Sync Performance",
  description = "Real-time status of data synchronization.",
  status,
  loading,
  metrics,
  rows,
  error,
  emptyText = "Sync status information is unavailable.",
  children,
  className,
}: SyncPerformanceProps) {
  
  const getStatusIcon = () => {
    if (status === "SUCCESS") return <CheckCircle2 className="size-3 text-emerald-500" />;
    if (status === "FAILED") return <XCircle className="size-3 text-red-500" />;
    return <Activity className="size-3 text-zinc-500" />;
  };

  return (
    <Card className={cn("rounded-[34px] border-white/5 bg-zinc-900/20 backdrop-blur-xl shadow-none overflow-hidden", className)}>
      <CardHeader className="pb-4 px-8 pt-8 flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight text-white">{title}</CardTitle>
          <CardDescription className="text-xs text-zinc-500">{description}</CardDescription>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "rounded-full border-white/10 px-3 py-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase",
            status === "SUCCESS" ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" :
            status === "FAILED" ? "bg-red-500/5 text-red-500 border-red-500/10" : "bg-white/5 text-zinc-400"
          )}
        >
          {getStatusIcon()}
          {status ?? "IDLE"}
        </Badge>
      </CardHeader>

      <CardContent className="px-8 pb-8 pt-2">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Activity className="size-5 text-zinc-600 animate-spin" />
          </div>
        ) : metrics.length || rows.length ? (
          <div className="space-y-8">
            {/* Metrikalar: Minimalist Cards */}
            {metrics.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className={cn(
                      "rounded-[24px] p-5 border transition-all duration-300",
                      metric.tone === "warning"
                        ? "bg-orange-500/5 border-orange-500/10"
                        : "bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.05]"
                    )}
                  >
                    <div className={cn(
                      "text-[10px] font-black uppercase tracking-[0.1em] mb-3",
                      metric.tone === "warning" ? "text-orange-500/70" : "text-zinc-500"
                    )}>
                      {metric.label}
                    </div>
                    <div className={cn(
                      "text-2xl font-black tabular-nums tracking-tighter",
                      metric.tone === "warning" ? "text-orange-500" : "text-white"
                    )}>
                      {metric.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Qatorlar: Elegant Divide */}
            {rows.length ? (
              <div className="space-y-1">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-3 px-2 rounded-xl hover:bg-white/[0.02] transition-colors border-b border-white/[0.02] last:border-0"
                  >
                    <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{row.label}</span>
                    <span className={cn("text-xs font-bold text-zinc-200 tabular-nums", row.valueClassName)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <div className="flex items-center gap-3 p-4 rounded-[20px] bg-red-500/5 border border-red-500/10 text-red-500 text-xs font-bold">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            ) : null}

            {children}
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-xs font-medium text-zinc-600 italic uppercase tracking-widest">
              {emptyText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}