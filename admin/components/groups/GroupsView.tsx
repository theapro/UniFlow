"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { groupsApi, sheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Group = {
  id: string;
  name: string;
  _count?: { students?: number };
};

type SheetsGroupsStatus = {
  enabled: boolean;
  allTabs: string[];
  validGroupTabs: string[];
  dbGroupsMissingTabs: Array<{ id: string; name: string }>;
};

export function GroupsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      groupsApi.list({ take: 1000 }).then((r) => r.data.data as Group[]),
  });

  const { data: sheetsGroups } = useQuery({
    queryKey: ["sheets", "groups", "status"],
    queryFn: () =>
      sheetsApi.groups.status().then((r) => r.data.data as SheetsGroupsStatus),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => groupsApi.create({ name }),
    onSuccess: async () => {
      setNewName("");
      setCreateOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({
          queryKey: ["sheets", "groups", "status"],
        }),
      ]);
    },
  });

  const syncGroupsMutation = useMutation({
    mutationFn: () => sheetsApi.groups.sync().then((r) => r.data.data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({
          queryKey: ["sheets", "groups", "status"],
        }),
        queryClient.invalidateQueries({ queryKey: ["sheets", "status"] }),
      ]);
    },
  });

  const missingTabsSet = React.useMemo(() => {
    const missing = sheetsGroups?.dbGroupsMissingTabs ?? [];
    return new Set(missing.map((g) => g.id));
  }, [sheetsGroups?.dbGroupsMissingTabs]);

  return (
    <div className="container space-y-4">
      <PageHeader
        title={dict?.groups?.title ?? "Groups"}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => syncGroupsMutation.mutate()}
              disabled={syncGroupsMutation.isPending || !sheetsGroups?.enabled}
            >
              {syncGroupsMutation.isPending
                ? (dict?.common?.loading ?? "Syncing...")
                : (dict?.groups?.syncSheets ?? "Sync with Sheets")}
            </Button>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>{dict?.groups?.create ?? "New group"}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {dict?.groups?.create ?? "New group"}
                  </DialogTitle>
                  <DialogDescription>
                    {dict?.groups?.createHint ??
                      "Creates a group in DB and (if enabled) a matching Google Sheets tab."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <Label htmlFor="groupName">
                    {dict?.common?.name ?? "Name"}
                  </Label>
                  <Input
                    id="groupName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={dict?.groups?.namePlaceholder ?? "e.g. 23A"}
                  />
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    disabled={createMutation.isPending}
                  >
                    {dict?.common?.cancel ?? "Cancel"}
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate(newName.trim())}
                    disabled={
                      createMutation.isPending || newName.trim().length === 0
                    }
                  >
                    {createMutation.isPending
                      ? (dict?.common?.loading ?? "Creating...")
                      : (dict?.common?.create ?? "Create")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {groupsLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : groups && groups.length ? (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <Link
                  key={g.id}
                  href={`/${lang}/dashboard/groups/${g.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{g.name}</div>
                        {typeof g._count?.students === "number" ? (
                          <Badge variant="outline" className="text-[10px]">
                            {g._count.students}{" "}
                            {dict?.students?.title ?? "students"}
                          </Badge>
                        ) : null}
                        {sheetsGroups?.enabled && missingTabsSet.has(g.id) ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {dict?.groups?.missingTab ?? "Missing tab"}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {dict?.groups?.openGroupHint ??
                          "Open group to view students"}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Users}
          title={dict?.groups?.noGroupsTitle ?? "No groups found"}
          description={
            dict?.groups?.noGroupsDescription ??
            "Create groups first, then you can view students by group here"
          }
        />
      )}
    </div>
  );
}
