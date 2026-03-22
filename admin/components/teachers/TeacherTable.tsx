"use client";

import { useState } from "react";
import Link from "next/link";
import { Teacher } from "@/types/teacher.types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { 
  MoreVertical, 
  User, 
  Mail, 
  Phone, 
  BookOpen, 
  Building2, 
  Eye, 
  Pencil, 
  Trash2, 
  KeyRound,
  ShieldCheck
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setDeleteId(null);
      toast.success("Teacher removed from system");
    },
  });

  const resendCredentialsMutation = useMutation({
    mutationFn: (id: string) => teachersApi.resendCredentials(id),
    onSuccess: () => toast.success("Credentials resent"),
  });

  const columns: ColumnDef<Teacher>[] = [
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
          <span>{dict.teachers.fullName}</span>
        </div>
      ),
      cell: ({ row }) => {
        const name = row.getValue("fullName") as string;
        const staffNo = row.original.staffNo;
        return (
          <div className="flex items-center gap-3 group">
            <Avatar className="h-9 w-9 rounded-full border border-white/10 bg-gradient-to-br from-white/5 to-transparent transition-transform group-hover:scale-105">
              <AvatarFallback className="bg-transparent text-muted-foreground">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-bold text-white/90 tracking-tight leading-none mb-1">{name}</span>
              <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-tighter">
                {staffNo ? `Staff ID: ${staffNo}` : "Faculty Member"}
              </span>
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
      id: "department",
      header: "Department",
      cell: ({ row }) => {
        const dept = row.original.department?.name;
        return (
          <div className="flex items-center gap-2 text-white/70">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-xs font-medium">{dept || "General Faculty"}</span>
          </div>
        );
      },
    },
    {
      id: "subjects",
      header: "Expertise",
      cell: ({ row }) => {
        const subjects = row.original.subjects ?? [];
        return (
          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
            {subjects.length > 0 ? (
              subjects.slice(0, 1).map((s) => (
                <div key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-primary/80">
                  <BookOpen className="h-2.5 w-2.5 mr-1 text-primary/40" />
                  {s.name}
                </div>
              ))
            ) : (
              <span className="text-[10px] text-muted-foreground/30 italic">No subjects</span>
            )}
            {subjects.length > 1 && (
              <span className="text-[9px] text-muted-foreground/40 self-center font-bold">+{subjects.length - 1} MORE</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const teacher = row.original;
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
                  <Link href={`/${lang}/dashboard/teachers/${teacher.id}/view`} className="flex items-center w-full">
                    <Eye className="mr-2.5 h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">View Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl cursor-pointer py-2.5 focus:bg-white/5">
                  <Link href={`/${lang}/dashboard/teachers/${teacher.id}`} className="flex items-center w-full">
                    <Pencil className="mr-2.5 h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium">Edit Details</span>
                  </Link>
                </DropdownMenuItem>
                {teacher.user?.email && (
                  <>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem 
                      disabled={resendCredentialsMutation.isPending}
                      onClick={() => resendCredentialsMutation.mutate(teacher.id)}
                      className="rounded-xl cursor-pointer py-2.5 focus:bg-white/5"
                    >
                      <KeyRound className="mr-2.5 h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium">Resend Access</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="my-1.5 bg-white/5" />
                <DropdownMenuItem 
                  onClick={() => setDeleteId(teacher.id)}
                  className="rounded-xl cursor-pointer py-2.5 text-red-400 focus:text-red-400 focus:bg-red-400/10"
                >
                  <Trash2 className="mr-2.5 h-4 w-4" />
                  <span className="text-sm font-medium">Remove Teacher</span>
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
          data={teachers}
          columns={columns}
          initialColumnVisibility={{
            phone: false,
            telegram: false,
            note: false,
            createdAt: false,
            updatedAt: false,
            staffNo: false,
          }}
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remove Instructor"
        description="Are you sure you want to remove this teacher? This will revoke their access to all assigned groups."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel="Remove Teacher"
        cancelLabel="Cancel"
      />
    </>
  );
}