"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { aiAdminApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DebugTrace = {
  message?: string;
  classification?: { type?: "tool" | "llm"; confidence?: number };
  tool?: { selected?: string | null; reason?: string | null };
  execution?: { durationMs?: number; startedAt?: string; endedAt?: string };
  database?: {
    query?: any;
    resultCount?: number | null;
    warnings?: any;
  };
  warnings?: string[];
  errors?: string[];
  finalResponse?: string;
};

export default function AiDebugConsolePage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const queryKey = useMemo(() => ["ai-debug-traces", cursor], [cursor]);

  const q = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await aiAdminApi.debugTraces.list({ take: 50, cursor });
      return res.data?.data;
    },
  });

  useEffect(() => {
    if (!q.isSuccess) return;
    const incoming = Array.isArray(q.data?.items) ? q.data.items : [];

    setItems((prev) => {
      if (cursor === null) return incoming;
      // Append with simple id de-dup
      const seen = new Set(prev.map((x: any) => String(x?.id ?? "")));
      const next = [...prev];
      for (const r of incoming) {
        const id = String((r as any)?.id ?? "");
        if (!id || !seen.has(id)) {
          next.push(r);
          if (id) seen.add(id);
        }
      }
      return next;
    });
  }, [q.isSuccess, q.data, cursor]);

  const list = items;
  const nextCursor = (q.data?.nextCursor ?? null) as string | null;

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title="AI Debug Console"
        description="Full internal flow for recent AI messages (tools, Prisma queries, warnings, final response)."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              setCursor(null);
              setItems([]);
              q.refetch();
            }}
            disabled={q.isFetching}
          >
            Refresh
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : null}
      {q.isError ? (
        <div className="text-sm text-destructive">
          Failed to load debug traces.
        </div>
      ) : null}

      <div className="space-y-4">
        {list.map((row, idx) => {
          const meta: any = row?.meta ?? null;
          const trace = (meta?.debugTrace ?? null) as DebugTrace | null;

          const userMessage = String(trace?.message ?? row?.userMessage ?? "");
          const toolUsed = trace?.tool?.selected ?? row?.toolName ?? null;
          const toolReason = trace?.tool?.reason ?? null;
          const resultCount =
            typeof trace?.database?.resultCount === "number"
              ? trace.database.resultCount
              : (trace?.database?.resultCount ?? null);

          const warnings = Array.isArray(trace?.warnings)
            ? trace!.warnings
            : [];
          const errors = Array.isArray(trace?.errors) ? trace!.errors : [];
          const queryObj = trace?.database?.query ?? null;

          const finalResponse = String(
            trace?.finalResponse ?? row?.assistantMessage ?? "",
          );

          const durationMs = trace?.execution?.durationMs;

          return (
            <Card
              key={row.id ?? idx}
              className="rounded-[32px] border border-border/40 bg-muted/10"
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>Message #{idx + 1}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {typeof durationMs === "number" ? `${durationMs}ms` : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    User
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {userMessage}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Tool
                    </div>
                    <div className="text-sm">
                      {toolUsed ? String(toolUsed) : "(none)"}
                    </div>
                    {toolReason ? (
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {toolReason}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Result Count
                    </div>
                    <div
                      className={
                        resultCount === 0
                          ? "text-sm text-destructive"
                          : "text-sm"
                      }
                    >
                      {resultCount === null || resultCount === undefined
                        ? "(unknown)"
                        : String(resultCount)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Query
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-2xl border border-border/40 bg-background/50 p-4 text-xs">
                    {queryObj
                      ? JSON.stringify(queryObj, null, 2)
                      : "(no query)"}
                  </pre>
                </div>

                {warnings.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Warnings
                    </div>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {errors.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Errors
                    </div>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                      {errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Final Response
                  </div>
                  <div className="text-sm whitespace-pre-wrap">
                    {finalResponse}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {nextCursor ? (
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setItems(list);
                setCursor(nextCursor);
              }}
              disabled={q.isFetching}
            >
              {q.isFetching ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
