"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Plus, Trash2, Pencil, Layers } from "lucide-react";
import { toast } from "sonner";

import { parentGroupsApi } from "@/lib/api";
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
import { Card, CardContent } from "@/components/ui/card";

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

  const [nameDraft, setNameDraft] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<ParentGroup | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () =>
      parentGroupsApi
        .list({ take: 1000 })
        .then((r) => r.data.data as ParentGroup[]),
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
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Failed to delete",
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
    <div className="container space-y-6 py-4">
      <PageHeader
        title={dict?.nav?.parentGroups ?? "Parent Groups"}
        description={
          dict?.parentGroups?.description ??
          "Create parent groups and assign groups under them."
        }
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {dict?.common?.create ?? "Create"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {dict?.parentGroups?.createTitle ?? "New parent group"}
                </DialogTitle>
                <DialogDescription>
                  {dict?.parentGroups?.createHint ??
                    "A parent group is a container for multiple groups."}
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

      <Card>
        <CardContent className="pt-6">
          <DataTable
            data={items ?? []}
            columns={columns}
            isLoading={isLoading}
            emptyLabel={dict?.parentGroups?.empty ?? "No parent groups yet."}
          />

          {!isLoading && (items ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
              <Layers className="h-8 w-8 mb-2" />
              {dict?.parentGroups?.emptyHint ?? "Create one to get started."}
            </div>
          ) : null}
        </CardContent>
      </Card>

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
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={dict?.common?.delete ?? "Delete"}
        description={
          dict?.parentGroups?.deleteConfirm ??
          "Delete this parent group? Groups will not be deleted; they will just be unassigned."
        }
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
