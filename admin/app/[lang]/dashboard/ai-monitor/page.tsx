"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { aiAdminApi } from "@/lib/api";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type AiSettings = {
  id: string;
  isEnabled: boolean;
  systemPrompt: string;
  toolPlannerPrompt: string;
  defaultUserChatModelId: string | null;
  defaultAdminChatModelId: string | null;
  updatedAt: string;
};

type AiToolConfig = {
  name: string;
  isEnabled: boolean;
  enabledForStudents: boolean;
  enabledForTeachers: boolean;
  enabledForAdmins: boolean;
  updatedAt: string;
};

function toolSection(
  name: string,
): "Student" | "Groups" | "Schedule" | "Admin" {
  if (name.includes("Schedule")) return "Schedule";
  if (name.startsWith("getStudent")) return "Student";
  if (name.startsWith("getGroup")) return "Groups";
  return "Admin";
}

type AiUsageLog = {
  id: string;
  userId: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN" | null;
  requestId: string | null;
  provider: string | null;
  model: string | null;
  toolName: string | null;
  status: "STARTED" | "OK" | "ERROR";
  error: string | null;
  ms: number | null;
  createdAt: string;
};

export default function AIMonitorPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["ai-admin-settings"],
    queryFn: async () => {
      const res = await aiAdminApi.settings.get();
      return res.data?.data as AiSettings;
    },
  });

  const { data: tools, isLoading: toolsLoading } = useQuery({
    queryKey: ["ai-admin-tools"],
    queryFn: async () => {
      const res = await aiAdminApi.tools.list();
      return (res.data?.data?.items ?? []) as AiToolConfig[];
    },
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["ai-admin-logs"],
    queryFn: async () => {
      const res = await aiAdminApi.logs.list({ take: 50 });
      return (res.data?.data?.items ?? []) as AiUsageLog[];
    },
  });

  const patchSettings = useMutation({
    mutationFn: async (patch: Partial<AiSettings>) => {
      const res = await aiAdminApi.settings.patch(patch);
      return res.data?.data as AiSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-admin-settings"] });
      toast.success("AI settings yangilandi");
    },
    onError: () => toast.error("AI settings yangilashda xatolik"),
  });

  const patchTool = useMutation({
    mutationFn: async ({
      name,
      patch,
    }: {
      name: string;
      patch: Partial<AiToolConfig>;
    }) => {
      const res = await aiAdminApi.tools.patch(name, patch);
      return res.data?.data as AiToolConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-admin-tools"] });
    },
    onError: () => toast.error("Tool sozlamasini yangilashda xatolik"),
  });

  const groupedTools = (() => {
    const items = tools ?? [];
    const sections: Record<
      "Student" | "Groups" | "Schedule" | "Admin",
      AiToolConfig[]
    > = {
      Student: [],
      Groups: [],
      Schedule: [],
      Admin: [],
    };
    for (const t of items) sections[toolSection(t.name)].push(t);
    return sections;
  })();

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <div className="flex flex-col gap-1">
        <PageHeader title="AI Monitor" />
        <p className="text-sm text-muted-foreground">
          AI sozlamalari, tool ruxsatlari va usage loglar.
        </p>
      </div>
      <Card className="rounded-[32px] border border-border/40 bg-muted/10">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : settings ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">AI Enabled</div>
                  <div className="text-xs text-muted-foreground">
                    Ochirib/yoqib qoyish (barcha rollar uchun)
                  </div>
                </div>
                <Switch
                  checked={settings.isEnabled}
                  disabled={patchSettings.isPending}
                  onCheckedChange={(v) =>
                    patchSettings.mutate({ isEnabled: v })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm font-medium">System Prompt</div>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {settings.systemPrompt || "(empty)"}
                  </pre>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Tool Planner Prompt</div>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                    {settings.toolPlannerPrompt || "(empty)"}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No settings</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[32px] border border-border/40 bg-muted/10">
        <CardHeader>
          <CardTitle>Tools</CardTitle>
        </CardHeader>
        <CardContent>
          {toolsLoading ? (
            <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead className="text-right">Enabled</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Teachers</TableHead>
                      <TableHead className="text-right">Admins</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-6 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : tools && tools.length > 0 ? (
            <div className="space-y-2">
              {(["Student", "Schedule", "Groups", "Admin"] as const).map(
                (section) => {
                  const items = groupedTools[section];
                  if (items.length === 0) return null;
                  return (
                    <Collapsible
                      key={section}
                      defaultOpen={section === "Student"}
                    >
                      <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{section}</div>
                          <Badge variant="secondary" className="text-[10px]">
                            {items.length}
                          </Badge>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="secondary" size="sm">
                            Toggle
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
                          <div className="overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tool</TableHead>
                                  <TableHead className="text-right">
                                    Enabled
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Students
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Teachers
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Admins
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {items.map((t) => (
                                  <TableRow key={t.name}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs">
                                          {t.name}
                                        </span>
                                        {!t.isEnabled ? (
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px]"
                                          >
                                            disabled
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Switch
                                        checked={t.isEnabled}
                                        disabled={patchTool.isPending}
                                        onCheckedChange={(v) =>
                                          patchTool.mutate({
                                            name: t.name,
                                            patch: { isEnabled: v },
                                          })
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Switch
                                        checked={t.enabledForStudents}
                                        disabled={
                                          !t.isEnabled || patchTool.isPending
                                        }
                                        onCheckedChange={(v) =>
                                          patchTool.mutate({
                                            name: t.name,
                                            patch: { enabledForStudents: v },
                                          })
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Switch
                                        checked={t.enabledForTeachers}
                                        disabled={
                                          !t.isEnabled || patchTool.isPending
                                        }
                                        onCheckedChange={(v) =>
                                          patchTool.mutate({
                                            name: t.name,
                                            patch: { enabledForTeachers: v },
                                          })
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Switch
                                        checked={t.enabledForAdmins}
                                        disabled={
                                          !t.isEnabled || patchTool.isPending
                                        }
                                        onCheckedChange={(v) =>
                                          patchTool.mutate({
                                            name: t.name,
                                            patch: { enabledForAdmins: v },
                                          })
                                        }
                                      />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                },
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tools</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Logs (last 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl border border-border/40 bg-muted/10 overflow-hidden">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Provider / Model</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">ms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-6 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-12 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : logs && logs.length > 0 ? (
                    logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.createdAt
                            ? new Date(l.createdAt).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {l.role ?? "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-mono">
                            {(l.provider ?? "-") + " / " + (l.model ?? "-")}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {l.toolName ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              l.status === "OK"
                                ? "default"
                                : l.status === "ERROR"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {typeof l.ms === "number" ? l.ms : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <p className="text-sm text-muted-foreground">No logs</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
