"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";

import { groupsApi, sheetsApi, studentsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { StudentTable } from "@/components/students/StudentTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
  dbGroupsMissingTabs: Array<{ id: string; name: string }>;
};

export function GroupDetailView({
  lang,
  dict,
  id,
}: {
  lang: string;
  dict: any;
  id: string;
}) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => groupsApi.getById(id).then((r) => r.data.data as Group),
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ["students", { groupId: id }],
    queryFn: () =>
      studentsApi.list({ groupId: id, take: 1000 }).then((r) => r.data.data),
  });

  const { data: sheetsGroups } = useQuery({
    queryKey: ["sheets", "groups", "status"],
    queryFn: () =>
      sheetsApi.groups.status().then((r) => r.data.data as SheetsGroupsStatus),
    staleTime: 30_000,
  });

  const missingTab = React.useMemo(() => {
    if (!sheetsGroups?.enabled) return false;
    return (sheetsGroups.dbGroupsMissingTabs ?? []).some((g) => g.id === id);
  }, [sheetsGroups, id]);

  const renameMutation = useMutation({
    mutationFn: (name: string) => groupsApi.update(id, { name }),
    onSuccess: async () => {
      setRenameOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({ queryKey: ["groups", id] }),
        queryClient.invalidateQueries({
          queryKey: ["sheets", "groups", "status"],
        }),
      ]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.remove(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
        queryClient.invalidateQueries({
          queryKey: ["sheets", "groups", "status"],
        }),
      ]);
      // Navigate back
      window.location.href = `/${lang}/dashboard/groups`;
    },
  });

  return (
    <div className="container space-y-4">
      <PageHeader
        title={group?.name ?? dict?.groups?.detailTitle ?? "Group"}
        actions={
          <div className="flex gap-2">
            {sheetsGroups?.enabled ? (
              missingTab ? (
                <Badge variant="destructive" className="self-center">
                  {dict?.groups?.missingTab ?? "Missing Sheets tab"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="self-center">
                  {dict?.groups?.tabOk ?? "Sheets tab OK"}
                </Badge>
              )
            ) : null}

            <Dialog
              open={renameOpen}
              onOpenChange={(o) => {
                setRenameOpen(o);
                if (o && group?.name) setNameDraft(group.name);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  {dict?.common?.edit ?? "Rename"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {dict?.groups?.rename ?? "Rename group"}
                  </DialogTitle>
                  <DialogDescription>
                    {dict?.groups?.renameHint ??
                      "Renames the group in DB and best-effort renames the matching Google Sheets tab."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="groupRename">
                    {dict?.common?.name ?? "Name"}
                  </Label>
                  <Input
                    id="groupRename"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRenameOpen(false)}
                    disabled={renameMutation.isPending}
                  >
                    {dict?.common?.cancel ?? "Cancel"}
                  </Button>
                  <Button
                    onClick={() => renameMutation.mutate(nameDraft.trim())}
                    disabled={
                      renameMutation.isPending || nameDraft.trim().length === 0
                    }
                  >
                    {renameMutation.isPending
                      ? (dict?.common?.loading ?? "Saving...")
                      : (dict?.common?.save ?? "Save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
            >
              {dict?.common?.delete ?? "Delete"}
            </Button>

            <Link href={`/${lang}/dashboard/groups`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {dict?.common?.back ?? "Back"}
              </Button>
            </Link>
          </div>
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={dict?.groups?.deleteTitle ?? "Delete group?"}
        description={
          dict?.groups?.deleteDescription ??
          "This deletes the group from the database. The Google Sheets tab is not removed by default."
        }
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteMutation.mutate()}
      />

      {groupLoading || studentsLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : students && students.length ? (
        <StudentTable students={students} lang={lang} dict={dict} />
      ) : (
        <EmptyState
          icon={Users}
          title={dict?.common?.noData ?? "No data"}
          description={
            dict?.groups?.noStudentsDescription ??
            "No students found in this group"
          }
        />
      )}
    </div>
  );
}
