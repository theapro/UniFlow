"use client";

import { useState } from "react";
import Link from "next/link";
import { Student } from "@/types/student.types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { MoreVertical } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentsApi } from "@/lib/api";
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

interface StudentTableProps {
  students: Student[];
  lang: string;
  dict: any;
}

export function StudentTable({ students, lang, dict }: StudentTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteId(null);
    },
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: (id: string) => studentsApi.resendCredentials(id),
    onSuccess: () => {
      toast.success("Credentials resent");
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to resend credentials";
      toast.error(msg);
    },
  });

  const columns: ColumnDef<Student>[] = [
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
      header: dict.students.fullName,
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("fullName")}</div>
      ),
    },
    {
      accessorKey: "studentNo",
      header: dict.students.studentNo,
      cell: ({ row }) => (row.getValue("studentNo") as string) || "-",
    },
    {
      id: "group",
      header: dict.students.group,
      accessorFn: (student) => student.group?.name || "-",
      cell: ({ row }) => row.getValue("group") as string,
    },
    {
      id: "actions",
      header: dict.common.actions,
      cell: ({ row }) => {
        const student = row.original;
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
                <Link href={`/${lang}/dashboard/students/${student.id}/view`}>
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${lang}/dashboard/students/${student.id}`}>
                  Edit
                </Link>
              </DropdownMenuItem>
              {student.user?.email ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={resendCredentialsMutation.isPending}
                    onClick={() => resendCredentialsMutation.mutate(student.id)}
                  >
                    Resend credentials
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteId(student.id)}
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
      <DataTable data={students} columns={columns} />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={dict.common.delete}
        description={dict.students.deleteConfirm}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict.common.delete}
        cancelLabel={dict.common.cancel}
      />
    </>
  );
}
