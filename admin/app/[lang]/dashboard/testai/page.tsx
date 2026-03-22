"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { aiAdminApi } from "@/lib/api";
import { authApi } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type DebugLog = {
  id: string;
  status: string;
  error: string | null;
  provider: string | null;
  model: string | null;
  toolName: string | null;
  toolArgs: any;
  ms: number | null;
  createdAt: string;
};

type ToolConfig = {
  name: string;
  isEnabled: boolean;
  enabledForStudents: boolean;
  enabledForTeachers: boolean;
  enabledForAdmins: boolean;
};

export default function TestAiPage() {
  const user = authApi.getStoredUser();
  const canSee = hasPermission(user, "ACCESS_AI_SETTINGS");

  const [asRole, setAsRole] = React.useState<"STUDENT" | "TEACHER" | "ADMIN">(
    "STUDENT",
  );
  const [message, setMessage] = React.useState<string>("");
  const [userId, setUserId] = React.useState<string>("");
  const [requestedModel, setRequestedModel] = React.useState<string>("");

  const [toolName, setToolName] = React.useState<string>("");
  const [toolArgsText, setToolArgsText] = React.useState<string>("{}");
  const [lastTool, setLastTool] = React.useState<{
    requestId: string;
    toolName: string;
    result: any;
    debugLog: DebugLog | null;
  } | null>(null);

  const [suite, setSuite] = React.useState<
    Array<{
      message: string;
      requestId: string;
      toolUsed: string | null;
      status: string | null;
      error: string | null;
      ms: number | null;
      reply: string;
    }>
  >([]);
  const [suiteRunning, setSuiteRunning] = React.useState(false);

  const [last, setLast] = React.useState<{
    reply: string;
    toolUsed: string | null;
    requestId: string;
    debugLog: DebugLog | null;
  } | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      const res = await aiAdminApi.testChat({
        message,
        asRole: asRole === "ADMIN" ? "STUDENT" : asRole,
        userId: userId.trim() ? userId.trim() : null,
        requestedModel: requestedModel.trim()
          ? requestedModel.trim()
          : undefined,
      });

      const data = res.data?.data;
      const log = (data?.debug?.log ?? null) as DebugLog | null;

      return {
        reply: String(data?.reply ?? ""),
        toolUsed: (data?.toolUsed ?? null) as string | null,
        requestId: String(data?.requestId ?? ""),
        debugLog: log,
      };
    },
    onSuccess: (r) => {
      setLast(r);
      if (r.debugLog?.status === "ERROR") {
        toast.error("AI xatolik bilan tugadi");
      } else {
        toast.success("AI javob berdi");
      }
    },
    onError: (e: any) => {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : typeof e?.message === "string"
            ? e.message
            : "Xatolik";
      toast.error(msg);
    },
  });

  const quickPrompts = React.useMemo(() => {
    const student = [
      "Men haqimdagi ma'lumotlarni bera olasanmi?",
      "Bugungi dars jadvalim qanday?",
      "Bu haftalik jadvalimni ko'rsat.",
      "Bu oygi schedulim qanday?",
      "O'qituvchilarim kimlar?",
    ];
    const teacher = [
      "Men haqimdagi ma'lumotlarni bera olasanmi?",
      "Bugun qaysi guruhlarda darsim bor?",
      "Bu oygi jadvalim qanday?",
      "Guruhlarim ro'yxatini bera olasanmi?",
    ];
    if (asRole === "TEACHER") return teacher;
    return student;
  }, [asRole]);

  async function runSuite() {
    try {
      setSuiteRunning(true);
      setSuite([]);

      for (const msg of quickPrompts) {
        const res = await aiAdminApi.testChat({
          message: msg,
          asRole: asRole === "ADMIN" ? "STUDENT" : asRole,
          userId: userId.trim() ? userId.trim() : null,
          requestedModel: requestedModel.trim()
            ? requestedModel.trim()
            : undefined,
        });
        const data = res.data?.data;
        const log = (data?.debug?.log ?? null) as DebugLog | null;

        setSuite((prev) => [
          ...prev,
          {
            message: msg,
            requestId: String(data?.requestId ?? ""),
            toolUsed: (data?.toolUsed ?? null) as string | null,
            status: log?.status ?? null,
            error: log?.error ?? null,
            ms: typeof log?.ms === "number" ? log.ms : null,
            reply: String(data?.reply ?? ""),
          },
        ]);
      }

      toast.success("Quick checks tugadi");
    } catch (e: any) {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : typeof e?.message === "string"
            ? e.message
            : "Xatolik";
      toast.error(msg);
    } finally {
      setSuiteRunning(false);
    }
  }

  const toolsQuery = useQuery({
    queryKey: ["ai-admin", "tools"],
    enabled: canSee,
    queryFn: async () => {
      const res = await aiAdminApi.tools.list();
      const items = (res.data?.data?.items ?? []) as ToolConfig[];
      return items;
    },
  });

  const runTool = useMutation({
    mutationFn: async () => {
      let parsedArgs: any = {};
      try {
        parsedArgs = toolArgsText.trim() ? JSON.parse(toolArgsText) : {};
      } catch {
        throw new Error("Args JSON noto'g'ri");
      }

      const res = await aiAdminApi.testTool({
        tool: toolName,
        args: parsedArgs,
        asRole,
        userId: userId.trim() ? userId.trim() : null,
      });

      const data = res.data?.data;
      const log = (data?.debug?.log ?? null) as DebugLog | null;

      return {
        requestId: String(data?.requestId ?? ""),
        toolName: String(data?.toolName ?? toolName),
        result: data?.result ?? null,
        debugLog: log,
      };
    },
    onSuccess: (r) => {
      setLastTool(r);
      if (r.debugLog?.status === "ERROR") toast.error("Tool error");
      else toast.success("Tool executed");
    },
    onError: (e: any) => {
      const msg =
        typeof e?.response?.data?.message === "string"
          ? e.response.data.message
          : typeof e?.message === "string"
            ? e.message
            : "Xatolik";
      toast.error(msg);
    },
  });

  if (!canSee) return null;

  return (
    <div className="container space-y-6">
      <div className="flex flex-col gap-1">
        <PageHeader title="Test AI" />
        <p className="text-sm text-muted-foreground">
          Admin sifatida AI assistant’ni STUDENT/TEACHER rolida sinab ko‘ring.
          Xatolik bo‘lsa, debug log’da aniq sabab ko‘rinadi.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>So‘rov</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Quick prompts</div>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="secondary"
                  onClick={() => setMessage(p)}
                  disabled={send.isPending || suiteRunning}
                >
                  {p}
                </Button>
              ))}
              <Button
                type="button"
                onClick={() => runSuite()}
                disabled={send.isPending || suiteRunning}
              >
                {suiteRunning ? "Running…" : "Run checks"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Test role</div>
              <Select value={asRole} onValueChange={(v) => setAsRole(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">STUDENT</SelectItem>
                  <SelectItem value="TEACHER">TEACHER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">User ID (optional)</div>
              <Input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Impersonate specific user UUID"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                Requested model (optional)
              </div>
              <Input
                value={requestedModel}
                onChange={(e) => setRequestedModel(e.target.value)}
                placeholder="e.g. qwen/qwen3-32b"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Message</div>
            <Textarea
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setMessage(e.target.value)
              }
              placeholder="Savolingizni yozing…"
              className="min-h-28"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => send.mutate()}
              disabled={send.isPending || message.trim().length === 0}
            >
              {send.isPending ? "Sending…" : "Send"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setMessage("");
                setLast(null);
              }}
              disabled={send.isPending}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tool runner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Tool</div>
              <Select
                value={toolName}
                onValueChange={(v) => setToolName(v)}
                disabled={toolsQuery.isLoading || toolsQuery.isError}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent>
                  {(toolsQuery.data ?? []).map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {toolsQuery.isError ? (
                <div className="text-xs text-destructive">
                  Tools list yuklanmadi
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Args (JSON)</div>
              <Textarea
                value={toolArgsText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setToolArgsText(e.target.value)
                }
                placeholder='e.g. {"studentId":"...","month":9,"year":2026}'
                className="min-h-28 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => runTool.mutate()}
              disabled={runTool.isPending || !toolName.trim()}
            >
              {runTool.isPending ? "Running…" : "Run tool"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setLastTool(null)}
              disabled={runTool.isPending}
            >
              Clear
            </Button>
          </div>

          {!lastTool ? (
            <p className="text-sm text-muted-foreground">
              Tool natijasi hali yo‘q.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  requestId: {lastTool.requestId}
                </Badge>
                <Badge variant="outline">tool: {lastTool.toolName}</Badge>
                {lastTool.debugLog?.status ? (
                  <Badge
                    variant={
                      lastTool.debugLog.status === "ERROR"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {lastTool.debugLog.status}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Result</div>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(lastTool.result ?? null, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Natija</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!last ? (
            <p className="text-sm text-muted-foreground">Hali so‘rov yo‘q.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">requestId: {last.requestId}</Badge>
                <Badge variant="outline">
                  tool: {last.toolUsed ?? "(none)"}
                </Badge>
                {last.debugLog?.status ? (
                  <Badge
                    variant={
                      last.debugLog.status === "ERROR"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {last.debugLog.status}
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Reply</div>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {last.reply || "(empty)"}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Debug</div>
                <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      status: last.debugLog?.status ?? null,
                      error: last.debugLog?.error ?? null,
                      provider: last.debugLog?.provider ?? null,
                      model: last.debugLog?.model ?? null,
                      toolName: last.debugLog?.toolName ?? null,
                      toolArgs: last.debugLog?.toolArgs ?? null,
                      ms: last.debugLog?.ms ?? null,
                      createdAt: last.debugLog?.createdAt ?? null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick checks</CardTitle>
        </CardHeader>
        <CardContent>
          {suite.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Hali quick checks yo‘q.
            </p>
          ) : (
            <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Message</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">ms</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suite.map((r) => (
                      <TableRow key={r.requestId || r.message}>
                        <TableCell className="text-xs">{r.message}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {r.toolUsed ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge
                            variant={
                              r.status === "ERROR"
                                ? "destructive"
                                : r.status
                                  ? "default"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {r.status ?? "-"}
                          </Badge>
                          {r.error ? (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {r.error}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {typeof r.ms === "number" ? r.ms : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
