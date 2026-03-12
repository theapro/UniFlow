"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
} from "lucide-react";

import { groupsApi, parentGroupsApi, sheetsApi, studentsApi } from "@/lib/api";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Group = {
  id: string;
  name: string;
  parentGroup?: { id: string; name: string } | null;
};

type ParentGroup = {
  id: string;
  name: string;
};

type SheetsGroupsStatus = {
  enabled: boolean;
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
  const router = useRouter();

  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");

  // Queries
  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => groupsApi.getById(id).then((r) => r.data.data as Group),
  });

  const { data: parentGroups } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () =>
      parentGroupsApi
        .list({ take: 1000 })
        .then((r) => r.data.data as ParentGroup[]),
    staleTime: 30_000,
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

  // Mutations
  const renameMutation = useMutation({
    mutationFn: (name: string) => groupsApi.update(id, { name }),
    onSuccess: async () => {
      setRenameOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["groups", id] });
    },
  });

  const updateParentGroupMutation = useMutation({
    mutationFn: (parentGroupId: string | null) =>
      groupsApi.update(id, { parentGroupId }),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups", id] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
      ]);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to update";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.push(`/${lang}/dashboard/groups`);
    },
  });

  const isLoading = groupLoading || studentsLoading;

  return (
    <div className="container space-y-6">
      {/* Top Navigation */}
      <Link
        href={`/${lang}/dashboard/groups`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {dict?.common?.back ?? "Groups"}
      </Link>

      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            {group?.name ?? "..."}
          </h1>

          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {sheetsGroups?.enabled ? (
              <div
                className={`flex items-center text-xs font-medium ${missingTab ? "text-destructive" : "text-emerald-600"}`}
              >
                {missingTab ? (
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                {missingTab
                  ? (dict?.groups?.missingTab ?? "Sync Error")
                  : (dict?.groups?.tabOk ?? "Synced with Sheets")}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Local group
              </span>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {dict?.parentGroups?.label ?? "Parent group"}:
              </span>
              <Select
                value={group?.parentGroup?.id ?? "none"}
                onValueChange={(v) =>
                  updateParentGroupMutation.mutate(v === "none" ? null : v)
                }
                disabled={updateParentGroupMutation.isPending}
              >
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue
                    placeholder={dict?.parentGroups?.select ?? "Select..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {dict?.common?.none ?? "None"}
                  </SelectItem>
                  {(parentGroups ?? []).map((pg) => (
                    <SelectItem key={pg.id} value={pg.id}>
                      {pg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Menu (3 dots) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setNameDraft(group?.name ?? "");
                setRenameOpen(true);
              }}
              className="cursor-pointer"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              {dict?.common?.edit ?? "Rename"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {dict?.common?.delete ?? "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Content Area */}
      <div className="pt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
            <p className="text-sm text-muted-foreground animate-pulse">
              {dict?.common?.loading ?? "Fetching students..."}
            </p>
          </div>
        ) : students && students.length > 0 ? (
          <div className=" rounded-xl">
            <StudentTable students={students} lang={lang} dict={dict} />
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={dict?.common?.noData ?? "Empty Group"}
            description={
              dict?.groups?.noStudentsDescription ??
              "Start by adding students to this group."
            }
          />
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dict?.groups?.rename ?? "Update Name"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label
              htmlFor="name"
              className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block"
            >
              {dict?.common?.name ?? "Group Name"}
            </Label>
            <Input
              id="name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              {dict?.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              onClick={() => renameMutation.mutate(nameDraft.trim())}
              disabled={renameMutation.isPending || !nameDraft.trim()}
              className="px-8"
            >
              {renameMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={dict?.groups?.deleteTitle ?? "Delete Group"}
        description={
          dict?.groups?.deleteDescription ??
          "This action is permanent and will remove all student references in this group."
        }
        confirmLabel={dict?.common?.delete ?? "Yes, Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
