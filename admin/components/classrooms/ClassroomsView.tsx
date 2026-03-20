"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreVertical, Plus, Trash2, Pencil, DoorClosed } from "lucide-react";
import { toast } from "sonner";

import { roomsApi } from "@/lib/api";
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

function roomFloorLabel(name: string): string | null {
  const raw = String(name ?? "").trim();
  const m = /(^|\b)(\d{3})(\b|$)/.exec(raw);
  if (!m) return null;
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n < 100 || n > 999) return null;
  const floor = Math.floor(n / 100);
  if (floor < 1 || floor > 9) return null;
  return `${floor}-qavat`;
}

type Room = {
  id: string;
  name: string;
  capacity: number | null;
  createdAt?: string;
  updatedAt?: string;
};

function fmtDate(value: string | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function ClassroomsView({
  lang: _lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [nameDraft, setNameDraft] = React.useState("");
  const [capacityDraft, setCapacityDraft] = React.useState("");
  const [editTarget, setEditTarget] = React.useState<Room | null>(null);

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms"],
    queryFn: () =>
      roomsApi.list({ take: 1000 }).then((r) => r.data.data as Room[]),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; capacity?: number | null }) =>
      roomsApi.create(payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Created");
      setNameDraft("");
      setCapacityDraft("");
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      name: string;
      capacity?: number | null;
    }) =>
      roomsApi.update(payload.id, {
        name: payload.name,
        ...(payload.capacity !== undefined
          ? { capacity: payload.capacity }
          : {}),
      }),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated");
      setEditOpen(false);
      setEditTarget(null);
      setNameDraft("");
      setCapacityDraft("");
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => roomsApi.remove(id),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Deleted");
      setDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed");
    },
  });

  const columns: ColumnDef<Room>[] = [
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
      id: "floor",
      header: "Floor",
      cell: ({ row }) => {
        const label = roomFloorLabel(row.original.name);
        return (
          <span className="text-sm text-muted-foreground">{label ?? "-"}</span>
        );
      },
    },
    {
      accessorKey: "capacity",
      header: dict?.classrooms?.capacity ?? "Capacity",
      cell: ({ row }) => {
        const v = row.getValue("capacity") as number | null;
        return (
          <span className="text-sm">{typeof v === "number" ? v : "-"}</span>
        );
      },
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
        const room = row.original;
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
                  setEditTarget(room);
                  setNameDraft(room.name ?? "");
                  setCapacityDraft(
                    typeof room.capacity === "number"
                      ? String(room.capacity)
                      : "",
                  );
                  setEditOpen(true);
                }}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4" />
                {dict?.common?.edit ?? "Edit"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteId(room.id)}
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

  const parsedCapacityDraft = capacityDraft.trim().length
    ? Number(capacityDraft)
    : null;

  const createDisabled =
    createMutation.isPending ||
    nameDraft.trim().length === 0 ||
    (parsedCapacityDraft !== null &&
      (!Number.isFinite(parsedCapacityDraft) || parsedCapacityDraft < 0));

  const editParsedCapacityDraft = capacityDraft.trim().length
    ? Number(capacityDraft)
    : null;

  const editDisabled =
    updateMutation.isPending ||
    !editTarget ||
    nameDraft.trim().length === 0 ||
    (editParsedCapacityDraft !== null &&
      (!Number.isFinite(editParsedCapacityDraft) ||
        editParsedCapacityDraft < 0));

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.nav?.classrooms ?? "Classrooms"}
        description={
          dict?.classrooms?.description ??
          "Manage classrooms (rooms) used in schedules."
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
                  {dict?.classrooms?.createTitle ?? "New classroom"}
                </DialogTitle>
                <DialogDescription>
                  {dict?.classrooms?.createHint ??
                    "Add a new room for scheduling."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="room-name">
                    {dict?.common?.name ?? "Name"}
                  </Label>
                  <Input
                    id="room-name"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder={
                      dict?.classrooms?.namePlaceholder ?? "e.g. Room 101"
                    }
                    className="h-10 rounded-2xl border-border/40 bg-background/50"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="room-capacity">
                    {dict?.classrooms?.capacity ?? "Capacity"}
                  </Label>
                  <Input
                    id="room-capacity"
                    inputMode="numeric"
                    value={capacityDraft}
                    onChange={(e) => setCapacityDraft(e.target.value)}
                    placeholder={
                      dict?.classrooms?.capacityPlaceholder ?? "Optional"
                    }
                    className="h-10 rounded-2xl border-border/40 bg-background/50"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={createMutation.isPending}
                  className="rounded-2xl"
                >
                  {dict?.common?.cancel ?? "Cancel"}
                </Button>
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      name: nameDraft.trim(),
                      capacity:
                        parsedCapacityDraft === null
                          ? null
                          : parsedCapacityDraft,
                    })
                  }
                  disabled={createDisabled}
                  className="rounded-2xl"
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
          data={rooms ?? []}
          columns={columns}
          isLoading={isLoading}
          emptyLabel={dict?.classrooms?.empty ?? "No classrooms yet."}
        />

        {!isLoading && (rooms ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
            <DoorClosed className="h-8 w-8 mb-2" />
            {dict?.classrooms?.emptyHint ?? "Create one to get started."}
          </div>
        ) : null}
      </section>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dict?.common?.edit ?? "Edit"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="room-edit-name">
                {dict?.common?.name ?? "Name"}
              </Label>
              <Input
                id="room-edit-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-10 rounded-2xl border-border/40 bg-background/50"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="room-edit-capacity">
                {dict?.classrooms?.capacity ?? "Capacity"}
              </Label>
              <Input
                id="room-edit-capacity"
                inputMode="numeric"
                value={capacityDraft}
                onChange={(e) => setCapacityDraft(e.target.value)}
                placeholder={
                  dict?.classrooms?.capacityPlaceholder ?? "Optional"
                }
                className="h-10 rounded-2xl border-border/40 bg-background/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditTarget(null);
                setNameDraft("");
                setCapacityDraft("");
              }}
              disabled={updateMutation.isPending}
              className="rounded-2xl"
            >
              {dict?.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              onClick={() =>
                editTarget &&
                updateMutation.mutate({
                  id: editTarget.id,
                  name: nameDraft.trim(),
                  capacity:
                    editParsedCapacityDraft === null
                      ? null
                      : editParsedCapacityDraft,
                })
              }
              disabled={editDisabled}
              className="rounded-2xl"
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
          dict?.classrooms?.deleteConfirm ??
          "Delete this classroom? If it is used in schedules, deletion may fail."
        }
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
