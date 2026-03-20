"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";

import { groupsApi, parentGroupsApi, sheetsApi, studentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { StudentTable } from "@/components/students/StudentTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { cn } from "@/lib/utils";

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

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");
  const [parentGroupDraft, setParentGroupDraft] =
    React.useState<string>("none");

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
  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; parentGroupId: string | null }) =>
      groupsApi.update(id, payload),
    onSuccess: async () => {
      setEditOpen(false);
      toast.success(dict?.common?.success ?? "Group updated");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groups", id] }),
        queryClient.invalidateQueries({ queryKey: ["groups"] }),
      ]);
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
    <div className="container max-w-7xl py-10 space-y-8">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center gap-4 px-1">
        <Link
          href={`/${lang}/dashboard/groups`}
          className="group flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {dict?.nav?.groups ?? "Groups Management"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground/90">
            {group?.name ?? "..."}
          </h1>
        </div>
      </div>

      {/* Header Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-[32px] border border-border/40 bg-muted/10 p-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sync Status Badge */}
              {sheetsGroups?.enabled ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold border",
                    missingTab
                      ? "bg-destructive/10 border-destructive/20 text-destructive"
                      : "bg-chart-2/10 border-chart-2/20 text-chart-2",
                  )}
                >
                  {missingTab ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {missingTab
                    ? (dict?.groups?.missingTab ?? "NOT SYNCED")
                    : (dict?.groups?.tabOk ?? "SHEETS SYNCED")}
                </div>
              ) : (
                <div className="rounded-full bg-muted/40 px-3 py-1 text-[11px] font-bold text-muted-foreground border border-border/40">
                  LOCAL DATA ONLY
                </div>
              )}

              {/* Student Count Badge */}
              <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary border border-primary/20">
                <Users className="h-3.5 w-3.5" />
                {students?.length ?? 0} {dict?.nav?.students ?? "STUDENTS"}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground">
                {dict?.parentGroups?.label ?? "Department group"}:
              </span>
              <div className="h-10 w-[260px] rounded-2xl border border-border/40 bg-background/50 px-4 flex items-center text-sm">
                {group?.parentGroup?.name ?? dict?.common?.none ?? "None"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl border-border/40 bg-background/50"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-border/40 p-2"
              >
                <DropdownMenuItem
                  onClick={() => {
                    setNameDraft(group?.name ?? "");
                    setParentGroupDraft(group?.parentGroup?.id ?? "none");
                    setEditOpen(true);
                  }}
                  className="rounded-xl p-3 cursor-pointer"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {dict?.common?.edit ?? "Edit"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="rounded-xl text-destructive focus:bg-destructive/10 focus:text-destructive p-3 cursor-pointer"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {dict?.common?.delete ?? "Delete Group"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="rounded-[32px] px-3 py-3 border border-border/40 bg-muted/5 overflow-hidden transition-all">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-2 border-primary/20" />
              <div className="absolute top-0 h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              {dict?.common?.loading ?? "Loading student records..."}
            </p>
          </div>
        ) : students && students.length > 0 ? (
          <div className="p-2">
            <StudentTable students={students} lang={lang} dict={dict} />
          </div>
        ) : (
          <div className="py-24">
            <EmptyState
              icon={Users}
              title={dict?.common?.noData ?? "No Students Yet"}
              description={
                dict?.groups?.noStudentsDescription ??
                "This group is currently empty. Add students to get started."
              }
            />
          </div>
        )}
      </div>

      {/* Dialogs - Minimal & Matching */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-[28px] border-border/40 bg-card p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {dict?.common?.edit ?? "Edit Group"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <Label
              htmlFor="name"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"
            >
              {dict?.common?.name ?? "New Group Name"}
            </Label>
            <Input
              id="name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-12 rounded-2xl border-border/40 bg-muted/20 px-4 focus-visible:ring-primary/20"
              autoFocus
            />

            <div className="space-y-2">
              <Label
                htmlFor="department"
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1"
              >
                {dict?.parentGroups?.label ?? "Department group"}
              </Label>
              <Select
                value={parentGroupDraft}
                onValueChange={setParentGroupDraft}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger
                  id="department"
                  className="h-12 rounded-2xl border-border/40 bg-muted/20 px-4"
                >
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              className="rounded-2xl h-12"
            >
              {dict?.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  name: nameDraft.trim(),
                  parentGroupId:
                    parentGroupDraft === "none" ? null : parentGroupDraft,
                })
              }
              disabled={updateMutation.isPending || !nameDraft.trim()}
              className="rounded-2xl h-12 px-8"
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {dict?.common?.save ?? "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={dict?.groups?.deleteTitle ?? "Delete Group?"}
        description={
          dict?.groups?.deleteDescription ??
          "All student associations for this group will be removed. This action cannot be undone."
        }
        confirmLabel={dict?.common?.delete ?? "Confirm Delete"}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
