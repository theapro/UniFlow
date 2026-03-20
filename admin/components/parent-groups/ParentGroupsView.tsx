"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Plus, Trash2, Pencil, Layers } from "lucide-react";
import { toast } from "sonner";

import { groupsApi, parentGroupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { ColumnDef } from "@tanstack/react-table";

type ParentGroup = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    groups?: number;
  };
};

type GroupRow = {
  id: string;
  name: string;
  parentGroupId?: string | null;
  parentGroup?: { id: string; name: string } | null;
};

function fmtDate(value: string | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function ParentGroupsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [manageOpen, setManageOpen] = React.useState(false);
  const [manageTarget, setManageTarget] = React.useState<ParentGroup | null>(
    null,
  );
  const [manageSelectedGroupIds, setManageSelectedGroupIds] = React.useState<
    string[]
  >([]);
  const [manageOriginalGroupIds, setManageOriginalGroupIds] = React.useState<
    string[]
  >([]);

  const [nameDraft, setNameDraft] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<ParentGroup | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () =>
      parentGroupsApi
        .list({ take: 1000 })
        .then((r) => r.data.data as ParentGroup[]),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups", "bulk"],
    queryFn: () =>
      groupsApi.list({ take: 2000 }).then((r) => r.data.data as GroupRow[]),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => parentGroupsApi.create({ name }),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Created");
      setNameDraft("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["parent-groups"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to create",
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string }) =>
      parentGroupsApi.update(payload.id, { name: payload.name }),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated");
      setEditOpen(false);
      setEditTarget(null);
      setNameDraft("");
      await queryClient.invalidateQueries({ queryKey: ["parent-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups", "bulk"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to update",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => parentGroupsApi.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["parent-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups", "bulk"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete",
      );
    },
  });

  const manageGroupsMutation = useMutation({
    mutationFn: async (payload: {
      parentGroupId: string;
      groupIds: string[];
    }) => {
      const allGroups = groups ?? [];
      const targetId = payload.parentGroupId;
      const desired = new Set(payload.groupIds);

      const currentlyInThis = new Set(
        allGroups
          .filter((g) => (g.parentGroup?.id ?? g.parentGroupId) === targetId)
          .map((g) => g.id),
      );

      const updates: Array<Promise<any>> = [];

      for (const g of allGroups) {
        const isInThis = currentlyInThis.has(g.id);
        const shouldBeInThis = desired.has(g.id);

        if (shouldBeInThis && !isInThis) {
          updates.push(groupsApi.update(g.id, { parentGroupId: targetId }));
        }

        if (!shouldBeInThis && isInThis) {
          updates.push(groupsApi.update(g.id, { parentGroupId: null }));
        }
      }

      await Promise.all(updates);
      return true;
    },
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Saved");
      setManageOpen(false);
      setManageTarget(null);
      setManageSelectedGroupIds([]);
      setManageOriginalGroupIds([]);
      await queryClient.invalidateQueries({ queryKey: ["parent-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      await queryClient.invalidateQueries({ queryKey: ["groups", "bulk"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update groups",
      );
    },
  });

  const columns: ColumnDef<ParentGroup>[] = [
    {
      accessorKey: "name",
      header: dict?.common?.name ?? "Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.getValue("name")}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {row.original.id}
          </span>
        </div>
      ),
    },
    {
      id: "groupsCount",
      header: dict?.nav?.groups ?? "Groups",
      accessorFn: (pg) => pg._count?.groups ?? 0,
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("groupsCount") as number}</span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: dict?.common?.updatedAt ?? "Updated",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {fmtDate(row.getValue("updatedAt") as string)}
        </span>
      ),
    },
    {
      id: "actions",
      header: dict?.common?.actions ?? "Actions",
      cell: ({ row }) => {
        const pg = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => {
                  setEditTarget(pg);
                  setNameDraft(pg.name ?? "");
                  setEditOpen(true);
                }}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                {dict?.common?.edit ?? "Edit"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const initial = (groups ?? [])
                    .filter(
                      (g) => (g.parentGroup?.id ?? g.parentGroupId) === pg.id,
                    )
                    .map((g) => g.id);

                  setManageTarget(pg);
                  setManageOriginalGroupIds(initial);
                  setManageSelectedGroupIds(initial);
                  setManageOpen(true);
                }}
                className="cursor-pointer"
              >
                <Layers className="mr-2 h-4 w-4" />
                {dict?.parentGroups?.manageGroups ?? "Manage groups"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteId(pg.id)}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {dict?.common?.delete ?? "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.nav?.parentGroups ?? "Department Groups"}
        description={
          dict?.parentGroups?.description ??
          "Create department groups and assign groups under them."
        }
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl">
                <Plus className="h-4 w-4 mr-2" />
                {dict?.common?.create ?? "Create"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {dict?.parentGroups?.createTitle ?? "New department group"}
                </DialogTitle>
                <DialogDescription>
                  {dict?.parentGroups?.createHint ??
                    "A department group is a container for multiple groups."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-2">
                <Label htmlFor="pg-name">{dict?.common?.name ?? "Name"}</Label>
                <Input
                  id="pg-name"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder={
                    dict?.parentGroups?.namePlaceholder ?? "e.g. Grade 10"
                  }
                  className="h-10 rounded-2xl border-border/40 bg-background/50"
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMutation.isPending}
                >
                  {dict?.common?.cancel ?? "Cancel"}
                </Button>
                <Button
                  className="rounded-2xl"
                  onClick={() => createMutation.mutate(nameDraft.trim())}
                  disabled={
                    createMutation.isPending || nameDraft.trim().length === 0
                  }
                >
                  {createMutation.isPending
                    ? (dict?.common?.loading ?? "Creating...")
                    : (dict?.common?.create ?? "Create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="rounded-[32px] border border-border/40 bg-muted/10 p-6">
        <DataTable
          data={items ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyLabel={dict?.parentGroups?.empty ?? "No department groups yet."}
        />

        {!isLoading && (items ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
            <Layers className="h-8 w-8 mb-2" />
            {dict?.parentGroups?.emptyHint ?? "Create one to get started."}
          </div>
        ) : null}
      </section>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict?.common?.edit ?? "Edit"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="pg-edit-name">{dict?.common?.name ?? "Name"}</Label>
            <Input
              id="pg-edit-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="h-10 rounded-2xl border-border/40 bg-background/50"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                setEditOpen(false);
                setEditTarget(null);
                setNameDraft("");
              }}
              disabled={updateMutation.isPending}
            >
              {dict?.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              className="rounded-2xl"
              onClick={() =>
                editTarget &&
                updateMutation.mutate({
                  id: editTarget.id,
                  name: nameDraft.trim(),
                })
              }
              disabled={
                updateMutation.isPending ||
                !editTarget ||
                nameDraft.trim().length === 0
              }
            >
              {updateMutation.isPending
                ? (dict?.common?.loading ?? "Saving...")
                : (dict?.common?.save ?? "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Groups Dialog */}
      <Dialog
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) {
            setManageTarget(null);
            setManageSelectedGroupIds([]);
            setManageOriginalGroupIds([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dict?.parentGroups?.manageGroupsTitle ?? "Manage groups"}
            </DialogTitle>
            <DialogDescription>
              {manageTarget
                ? (dict?.parentGroups?.manageGroupsHint ??
                  "Select which groups belong to this department group.")
                : (dict?.parentGroups?.manageGroupsHint ??
                  "Select which groups belong to this department group.")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              {manageTarget?.name ?? "-"}
            </div>
            <div>
              {(dict?.parentGroups?.selected ?? "Selected") + ": "}
              <span className="font-medium">
                {manageSelectedGroupIds.length}
              </span>
            </div>
          </div>

          <ScrollArea className="max-h-[50vh] rounded-md border p-2">
            {groups ? (
              <div className="space-y-1">
                {[...groups]
                  .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
                  .map((g) => {
                    const checked = manageSelectedGroupIds.includes(g.id);
                    const currentParentId =
                      g.parentGroup?.id ?? g.parentGroupId;
                    const currentParentName = g.parentGroup?.name;
                    const showHint =
                      currentParentId &&
                      manageTarget &&
                      currentParentId !== manageTarget.id;

                    return (
                      <label
                        key={g.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const isChecked = next === true;
                            setManageSelectedGroupIds((prev) => {
                              if (isChecked) {
                                return prev.includes(g.id)
                                  ? prev
                                  : [...prev, g.id];
                              }
                              return prev.filter((id) => id !== g.id);
                            });
                          }}
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-medium">
                            {g.name}
                          </span>
                          {showHint ? (
                            <span className="block text-xs text-muted-foreground">
                              {(dict?.parentGroups?.currentlyIn ??
                                "Currently in") + ": "}
                              {currentParentName || currentParentId}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                {dict?.common?.loading ?? "Loading..."}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setManageOpen(false)}
              disabled={manageGroupsMutation.isPending}
            >
              {dict?.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              onClick={() =>
                manageTarget &&
                manageGroupsMutation.mutate({
                  parentGroupId: manageTarget.id,
                  groupIds: manageSelectedGroupIds,
                })
              }
              disabled={
                manageGroupsMutation.isPending ||
                !manageTarget ||
                !groups ||
                (() => {
                  const a = new Set(manageOriginalGroupIds);
                  const b = new Set(manageSelectedGroupIds);
                  if (a.size !== b.size) return false;
                  for (const id of a) if (!b.has(id)) return false;
                  return true;
                })()
              }
            >
              {manageGroupsMutation.isPending
                ? (dict?.common?.loading ?? "Saving...")
                : (dict?.common?.save ?? "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={dict?.common?.delete ?? "Delete"}
        description={
          dict?.parentGroups?.deleteConfirm ??
          "Delete this department group? Groups will not be deleted; they will just be unassigned."
        }
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
