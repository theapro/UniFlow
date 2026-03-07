"use client";

import { useState } from "react";
import Link from "next/link";
import { Teacher } from "@/types/teacher.types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoreVertical } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teachersApi } from "@/lib/api";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeacherTableProps {
  teachers: Teacher[];
  lang: string;
  dict: any;
}

export function TeacherTable({ teachers, lang, dict }: TeacherTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachersApi.remove(id),
    onSuccess: () => {
      toast.success(dict?.common?.success ?? "Done");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setDeleteId(null);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to delete";
      toast.error(msg);
    },
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: (id: string) => teachersApi.resendCredentials(id),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend credentials";
      toast.error(msg);
    },
  });

  const columns: ColumnDef<Teacher>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "fullName",
      header: dict.teachers.fullName,
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("fullName")}</div>
      ),
    },
    {
      accessorKey: "staffNo",
      header: dict.teachers.staffNo,
      cell: ({ row }) => (row.getValue("staffNo") as string) || "-",
    },
    {
      accessorKey: "email",
      header: dict.teachers.email || "Email",
      accessorFn: (t) => t.email || t.user?.email || "-",
      cell: ({ row }) => (row.getValue("email") as string) || "-",
    },
    {
      accessorKey: "phone",
      header: dict.teachers.phone || "Phone",
      cell: ({ row }) => (row.getValue("phone") as string) || "-",
    },
    {
      accessorKey: "telegram",
      header: dict.teachers.telegram || "Telegram",
      cell: ({ row }) => (row.getValue("telegram") as string) || "-",
    },
    {
      id: "subjects",
      header: dict.teachers.subjects || "Subjects",
      accessorFn: (t) =>
        (t.subjects ?? []).map((s) => s.name).join(", ") || "-",
      cell: ({ row }) => row.getValue("subjects") as string,
    },
    {
      id: "department",
      header: dict.teachers.department,
      accessorFn: (teacher) => teacher.department?.name || "-",
      cell: ({ row }) => row.getValue("department") as string,
    },
    {
      accessorKey: "note",
      header: dict.teachers.note || "Note",
      cell: ({ row }) => (row.getValue("note") as string) || "-",
    },
    {
      accessorKey: "createdAt",
      header: dict.common.createdAt || "Created",
      cell: ({ row }) => {
        const v = row.getValue("createdAt") as string;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? v || "-" : d.toLocaleString();
      },
    },
    {
      accessorKey: "updatedAt",
      header: dict.common.updatedAt || "Updated",
      cell: ({ row }) => {
        const v = row.getValue("updatedAt") as string;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? v || "-" : d.toLocaleString();
      },
    },
    {
      id: "actions",
      header: dict.common.actions,
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/${lang}/dashboard/teachers/${teacher.id}/view`}>
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${lang}/dashboard/teachers/${teacher.id}`}>
                  Edit
                </Link>
              </DropdownMenuItem>
              {teacher.user?.email ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={resendCredentialsMutation.isPending}
                    onClick={() => resendCredentialsMutation.mutate(teacher.id)}
                  >
                    Resend credentials
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteId(teacher.id)}
                className="text-destructive focus:text-destructive"
              >
                Delete
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
    <>
      <DataTable
        data={teachers}
        columns={columns}
        initialColumnVisibility={{
          phone: false,
          telegram: false,
          note: false,
          createdAt: false,
          updatedAt: false,
        }}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={dict.common.delete}
        description={dict.teachers.deleteConfirm}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict.common.delete}
        cancelLabel={dict.common.cancel}
      />
    </>
  );
}
