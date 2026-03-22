"use client";

import { useState } from "react";
import Link from "next/link";
import { Student } from "@/types/student.types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { 
  MoreVertical, 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  ShieldCheck, 
  Eye, 
  Pencil, 
  Trash2, 
  Send,
  Fingerprint
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function StudentTable({ students, lang, dict }: { students: Student[]; lang: string; dict: any }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setDeleteId(null);
      toast.success("Student removed from system");
    },
  });

  const columns: ColumnDef<Student>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      ),
    },
    {
      accessorKey: "fullName",
      header: () => (
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span>{dict.students.fullName}</span>
        </div>
      ),
      cell: ({ row }) => {
        const name = row.getValue("fullName") as string;
        return (
          <div className="flex items-center gap-3 group">
            <Avatar className="h-9 w-9 rounded-full border border-white/10 bg-gradient-to-br from-white/5 to-transparent transition-transform group-hover:scale-105">
              <AvatarFallback className="bg-transparent text-muted-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-white/90 tracking-tight leading-none mb-1">{name}</span>
              <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-tighter">Student Profile</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground/80 hover:text-white transition-colors cursor-default">
            <Mail className="h-3 w-3 text-primary/40" />
            <span className="text-xs truncate max-w-[150px]">{row.getValue("email") || "—"}</span>
          </div>
          {row.original.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground/40 text-[10px]">
              <Phone className="h-2.5 w-2.5" />
              <span>{row.original.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = (row.getValue("status") as string)?.toUpperCase();
        const isActive = status === "ACTIVE";
        return (
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-all",
            isActive 
              ? " text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.05)]" 
              : " text-zinc-500"
          )}>
            <div className={cn("h-1 w-1 rounded-full animate-pulse", isActive ? "bg-emerald-500" : "bg-zinc-500")} />
            <span className="text-[12px] font-black uppercase tracking-[0.1em]">{status || "OFFLINE"}</span>
          </div>
        );
      },
    },
    {
      id: "group",
      header: "Placement",
      cell: ({ row }) => {
        const group = row.original.group?.name;
        return (
          <div className="flex flex-col gap-1.5">
             <div className="inline-flex items-center w-fit px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-primary/80">
              <Fingerprint className="h-2.5 w-2.5 mr-1 text-primary/40" />
              {group || "N/A"}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const id = row.original.id;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-white/5 rounded-xl transition-all">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl border-white/10 bg-zinc-950/90 backdrop-blur-2xl shadow-2xl">
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5 focus:bg-white/5">
                  <Link href={`/${lang}/dashboard/students/${id}/view`} className="flex items-center w-full">
                    <Eye className="mr-2.5 h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">View Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5 focus:bg-white/5">
                  <Link href={`/${lang}/dashboard/students/${id}`} className="flex items-center w-full">
                    <Pencil className="mr-2.5 h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium">Edit Details</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1.5 bg-white/5" />
                <DropdownMenuItem 
                  onClick={() => setDeleteId(id)}
                  className="rounded-xl cursor-pointer py-2.5 text-red-400 focus:text-red-400 focus:bg-red-400/10"
                >
                  <Trash2 className="mr-2.5 h-4 w-4" />
                  <span className="text-sm font-medium">Remove Student</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div>
        <DataTable
          data={students}
          columns={columns}
          initialColumnVisibility={{
            studentNo: false,
            cohort: false,
            teacherIds: false,
            parentIds: false,
            note: false,
            createdAt: false,
            updatedAt: false,
          }}
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Confirm Removal"
        description="This action cannot be undone. All student records will be permanently archived."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel="Remove Student"
        cancelLabel="Keep Record"
      />
    </>
  );
}