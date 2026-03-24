"use client";

import * as React from "react";
import { AlertTriangle, Globe, Link2, Sheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SourceSpreadsheetProps = {
  dict: any;
  description?: string;
  healthLoading: boolean;
  health: any;
  spreadsheetIdDraft: string;
  onSpreadsheetIdDraftChange: (value: string) => void;
  onConnect: () => void;
  isConnecting: boolean;
  className?: string;
};

export function SourceSpreadsheet({
  dict,
  description = "Target Google Sheet configuration",
  healthLoading,
  health,
  spreadsheetIdDraft,
  onSpreadsheetIdDraftChange,
  onConnect,
  isConnecting,
  className,
}: SourceSpreadsheetProps) {
  const connection = (health?.connection ?? null) as any;
  const attempted = Boolean(connection?.attempted);
  const ok = Boolean(connection?.ok);

  return (
    <Card className={cn("rounded-[34px] border-white/5 bg-zinc-900/20 backdrop-blur-xl shadow-none overflow-hidden h-fit", className)}>
      <CardHeader className="p-8 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Globe className="size-4 text-zinc-500" />
          <CardTitle className="text-lg font-bold tracking-tight text-white">
            {dict?.sheets?.connectionTitle ?? "Source Engine"}
          </CardTitle>
        </div>
        <CardDescription className="text-xs text-zinc-500 leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-8 pt-2 space-y-6">
        {healthLoading ? (
          <div className="py-6 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : health ? (
          <>
            {/* Input Section */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                Spreadsheet Identifier
              </div>
              <div className="flex gap-2 p-1.5 rounded-[20px] bg-white/[0.03] border border-white/5 focus-within:border-white/20 transition-all">
                <Input
                  value={spreadsheetIdDraft}
                  onChange={(e) => onSpreadsheetIdDraftChange(e.target.value)}
                  placeholder="Enter Spreadsheet ID..."
                  className="bg-transparent border-none focus-visible:ring-0 font-mono text-[11px] h-9 text-zinc-300 placeholder:text-zinc-600 shadow-none"
                />
                <Button 
                  onClick={onConnect} 
                  disabled={isConnecting}
                  className="h-9 rounded-[14px] px-5 font-bold text-[10px] uppercase tracking-wider bg-white text-black hover:bg-zinc-200 transition-all active:scale-95"
                >
                  {isConnecting ? "..." : (dict?.common?.connect ?? "Connect")}
                </Button>
              </div>
              {health.config?.clientEmail && (
                <div className="flex items-start gap-2 px-2">
                  <Link2 className="size-3 text-zinc-600 mt-0.5" />
                  <div className="text-[10px] leading-normal text-zinc-500 font-medium">
                    Grant access to: <span className="text-zinc-300 select-all">{health.config.clientEmail}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className={cn(
                "rounded-full border-none px-3 py-1 text-[9px] font-black tracking-widest uppercase",
                health.config?.enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
              )}>
                {health.config?.enabled ? "Integration Active" : "Disabled"}
              </Badge>

              <Badge className={cn(
                "rounded-full border-none px-3 py-1 text-[9px] font-black tracking-widest uppercase",
                attempted ? (ok ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-500") : "bg-zinc-800 text-zinc-500"
              )}>
                {attempted ? (ok ? "Verified" : "Sync Error") : "Unlinked"}
              </Badge>
            </div>

            {/* Connection Status Details */}
            {attempted && ok ? (
              <div className="space-y-4 rounded-[24px] bg-white/[0.02] border border-white/[0.05] p-5">
                <div className="grid gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Sheet className="size-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Active Sheet</div>
                      <div className="text-sm font-bold text-zinc-200 truncate max-w-[180px]">
                        {connection?.spreadsheet?.title ?? "(Untitled)"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="h-px bg-white/[0.05]" />
                  
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Detected Tabs</div>
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-2 scrollbar-hide">
                      {(connection?.sheetTitles ?? []).map((title: string, i: number) => (
                        <Badge
                          key={`${title}-${i}`}
                          variant="outline"
                          className="rounded-full border-white/[0.05] bg-white/[0.02] text-zinc-400 text-[9px] font-bold px-2 py-0.5 hover:text-white transition-colors"
                        >
                          {title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : attempted && !ok ? (
              <div className="flex gap-3 p-4 rounded-[20px] bg-red-500/5 border border-red-500/10 text-red-400">
                <AlertTriangle className="size-4 shrink-0" />
                <div className="text-[11px] font-bold leading-relaxed">
                  {connection?.error ?? "Authentication failed. Check spreadsheet permissions."}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-6 text-center text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
            No Configuration
          </div>
        )}
      </CardContent>
    </Card>
  );
}