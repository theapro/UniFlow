"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Eye, Trash2, Search } from "lucide-react";

import { subjectsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";

type Subject = {
  id: string;
  name: string;
  code: string | null;
  cohort?: {
    id: string;
    code: string;
    sortOrder: number;
    year?: number | null;
  } | null;
  parentGroup?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    teachers: number;
    lessons: number;
  };
};

const FIXED_DEPARTMENTS = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
] as const;

function cohortLabel(c?: { code?: string; year?: number | null } | null) {
  const code = String(c?.code ?? "").trim();
  if (!code) return "(No cohort)";
  const year = typeof c?.year === "number" ? c?.year : null;
  return year ? `${code} (${year})` : code;
}

function fmtDate(value: string | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function SubjectsView({ lang, dict }: { lang: string; dict: any }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [editTarget, setEditTarget] = React.useState<Subject | null>(null);

  const [q, setQ] = React.useState("");

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");

  const { data: subjects, isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list({ take: 1000 }).then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; code?: string | null }) =>
      subjectsApi.update(payload.id, {
        name: payload.name,
        code: payload.code,
      }),
    onSuccess: async () => {
      setEditOpen(false);
      setEditTarget(null);
      toast.success(dict?.common?.success ?? "Updated successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.remove(id),
    onSuccess: async () => {
      setDeleteId(null);
      toast.success(dict?.common?.success ?? "Deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to delete");
    },
  });

  const filtered = (subjects ?? []).filter((s: Subject) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const hay = [
      s.name,
      s.code ?? "",
      s.parentGroup?.name ?? "",
      s.cohort?.code ?? "",
      String(s.cohort?.year ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });

  const subjectsByDept = React.useMemo(() => {
    const out = new Map<string, Subject[]>();
    for (const s of filtered) {
      const deptName = s.parentGroup?.name ?? "(No department)";
      const list = out.get(deptName) ?? [];
      list.push(s);
      out.set(deptName, list);
    }
    return out;
  }, [filtered]);

  const orderedDepts = FIXED_DEPARTMENTS.filter((n) => subjectsByDept.has(n));
  const otherDepts = Array.from(subjectsByDept.keys())
    .filter((n) => !orderedDepts.includes(n as any))
    .sort((a, b) => a.localeCompare(b));

  const renderDept = (deptName: string) => {
    const deptSubjects = (subjectsByDept.get(deptName) ?? []).slice();

    const byCohort = new Map<
      string,
      { sortOrder: number; year: number | null; subjects: Subject[] }
    >();
    for (const s of deptSubjects) {
      const code = s.cohort?.code ? String(s.cohort.code) : "(No cohort)";
      const sortOrder = Number(s.cohort?.sortOrder ?? 999);
      const year = typeof s.cohort?.year === "number" ? s.cohort.year : null;
      const entry = byCohort.get(code) ?? { sortOrder, year, subjects: [] };
      entry.subjects.push(s);
      entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
      entry.year = entry.year ?? year;
      byCohort.set(code, entry);
    }

    const cohorts = Array.from(byCohort.entries())
      .map(([code, v]) => ({ code, sortOrder: v.sortOrder, year: v.year }))
      .sort((a, b) => {
        const r = a.sortOrder - b.sortOrder;
        if (r !== 0) return r;
        return a.code.localeCompare(b.code);
      });

    return (
      <Card key={deptName}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{deptName}</div>
            <Badge variant="outline" className="text-[10px]">
              {deptSubjects.length} subjects
            </Badge>
          </div>

          <div className="space-y-3">
            {cohorts.map((c) => {
              const list = (byCohort.get(c.code)?.subjects ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));

              return (
                <div key={c.code} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {c.code === "(No cohort)"
                        ? c.code
                        : cohortLabel({ code: c.code, year: c.year })}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      {list.length} subjects
                    </div>
                  </div>

                  <div className="divide-y rounded-md border">
                    {list.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {subject.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {subject.code ? (
                              <Badge variant="outline" className="font-mono">
                                {subject.code}
                              </Badge>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {subject.id}
                            </span>
                            <Badge variant="secondary" className="h-5">
                              {subject._count?.teachers ?? 0} Teachers
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {fmtDate(subject.updatedAt)}
                            </span>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/${lang}/dashboard/subjects/${subject.id}/view`}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/${lang}/dashboard/subjects/${subject.id}/edit`}
                                className="flex items-center gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditTarget(subject);
                                setName(subject.name || "");
                                setCode(subject.code || "");
                                setEditOpen(true);
                              }}
                              className="flex items-center gap-2"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Quick Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteId(subject.id)}
                              className="text-destructive focus:text-destructive flex items-center gap-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container space-y-6 py-4">
      <PageHeader
        title={dict?.nav?.subjects ?? "Subjects"}
        description="Manage study subjects and linkage with teachers and curriculum."
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={dict?.common?.search ?? "Search..."}
                className="pl-9 w-[260px]"
              />
            </div>
            <Button asChild className="shadow-sm">
              <Link href={`/${lang}/dashboard/subjects/create`}>
                <Plus className="h-4 w-4 mr-2" />
                {dict?.subjects?.addSubject ?? "Add Subject"}
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-none shadow-none">
        <CardContent className="p-0">
          <div className="p-4  flex items-center justify-between gap-3">
            <div className="sm:hidden relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={dict?.common?.search ?? "Search..."}
                className="pl-9"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">
              {dict?.common?.loading ?? "Loading..."}
            </div>
          ) : filtered.length ? (
            <div className="px-4 pb-4 space-y-4">
              {orderedDepts.map(renderDept)}
              {otherDepts.map(renderDept)}
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              {dict?.common?.noResults ?? "No results."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject name or code. Changes will sync to Sheets if
              enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input
                id="edit-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editTarget &&
                updateMutation.mutate({ id: editTarget.id, name, code })
              }
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={dict?.common?.delete ?? "Delete Subject"}
        description={
          dict?.subjects?.deleteConfirmHint ??
          "Are you sure? This will delete schedule entries and lessons related to this subject."
        }
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        confirmLabel={dict?.common?.delete ?? "Delete"}
        cancelLabel={dict?.common?.cancel ?? "Cancel"}
      />
    </div>
  );
}
