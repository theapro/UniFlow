"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  Search,
  BookOpen,
  LayoutGrid,
  Layers,
  MoreVertical,
} from "lucide-react";

import { subjectsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    queryFn: () =>
      subjectsApi.list({ take: 1000 }).then((r) => r.data.data as Subject[]),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; name: string; code?: string | null }) =>
      subjectsApi.update(payload.id, {
        name: payload.name,
        code: payload.code,
      }),
    onSuccess: async () => {
      setEditOpen(false);
      toast.success(dict?.common?.success ?? "Updated successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subjectsApi.remove(id),
    onSuccess: async () => {
      setDeleteId(null);
      toast.success(dict?.common?.success ?? "Deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
    },
  });

  const filtered = (subjects ?? []).filter((s) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${s.name} ${s.code ?? ""} ${s.parentGroup?.name ?? ""} ${s.cohort?.code ?? ""}`
      .toLowerCase()
      .includes(needle);
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

  const allDepts = React.useMemo(() => {
    const existing = Array.from(subjectsByDept.keys());
    const ordered = FIXED_DEPARTMENTS.filter((n) => existing.includes(n));
    const others = existing
      .filter((n) => !FIXED_DEPARTMENTS.includes(n as any))
      .sort();
    return [...ordered, ...others];
  }, [subjectsByDept]);

  const renderCohortGroups = (deptSubjects: Subject[]) => {
    const byCohort = new Map<string, Subject[]>();
    deptSubjects.forEach((s) => {
      const cCode = s.cohort?.code ?? "(No cohort)";
      const list = byCohort.get(cCode) ?? [];
      list.push(s);
      byCohort.set(cCode, list);
    });

    return (
      <div className="space-y-10 py-4 px-1">
        {Array.from(byCohort.entries()).map(([cohortCode, list]) => (
          <div key={cohortCode} className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 border border-white/10">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-white/80">
                  {cohortCode}
                </span>
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((subject) => (
                  <div key={subject.id} className="group relative">
                    {/* Butun kartochka Link hisoblanadi */}
                    <Link
                      href={`/${lang}/dashboard/subjects/${subject.id}/view`}
                      className="flex items-center justify-between p-5 rounded-[22px] border border-white/[0.06] bg-white/[0.03] transition-all hover:bg-white/[0.06] hover:border-white/20 hover:translate-y-[-2px] active:scale-[0.98]"
                    >
                      <div className="space-y-2 min-w-0">
                        <h4 className="text-[15px] font-bold text-white/90 truncate group-hover:text-white">
                          {subject.name}
                        </h4>
                        <div className="flex items-center gap-3">
                          {subject.code && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-white/10"
                            >
                              {subject.code}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>
                              {subject._count?.teachers ?? 0} Teachers
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Menu uchun joy qoldiramiz (lekin buni bosganda Link ishlamasligi kerak) */}
                      <div className="w-8 h-8" />
                    </Link>

                    {/* DropdownMenu Link ustida turadi, lekin mustaqil ishlaydi */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-white/10"
                            onClick={(e) => e.preventDefault()} // Link ishga tushib ketmasligi uchun
                          >
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-44 rounded-xl"
                        >
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/${lang}/dashboard/subjects/${subject.id}/view`}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation(); // Muhim!
                              setEditTarget(subject);
                              setName(subject.name);
                              setCode(subject.code || "");
                              setEditOpen(true);
                            }}
                            className="gap-2"
                          >
                            <Pencil className="h-4 w-4" /> Quick Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation(); // Muhim!
                              setDeleteId(subject.id);
                            }}
                            className="text-destructive focus:text-destructive gap-2"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.nav?.subjects ?? "Subjects Explorer"}
        description="Manage study subjects organized by departments and cohorts."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search subjects..."
                className="pl-10 w-[280px] h-11 rounded-2xl bg-[#0A0A0A] border-white/10"
              />
            </div>
            <Button
              asChild
              className="h-11 px-5 rounded-2xl bg-white text-black hover:bg-white/90"
            >
              <Link href={`/${lang}/dashboard/subjects/create`}>
                <Plus className="h-4 w-4 mr-2" /> Add Subject
              </Link>
            </Button>
          </div>
        }
      />

      <Accordion type="single" collapsible className="space-y-4">
        {allDepts.map((dept) => (
          <AccordionItem
            key={dept}
            value={dept}
            className="border-none bg-muted/10 rounded-[32px] px-6 transition-all data-[state=open]:bg-muted/20 border border-transparent data-[state=open]:border-border/40"
          >
            <AccordionTrigger className="hover:no-underline py-7 group">
              <div className="flex items-center gap-5 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-muted-foreground group-hover:text-white transition-all">
                  <LayoutGrid className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg font-bold tracking-tight text-white/90 group-hover:text-white">
                    {dept}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    {(subjectsByDept.get(dept) ?? []).length} Subjects Available
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {renderCohortGroups(subjectsByDept.get(dept) ?? [])}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Quick Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Quick Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject basic information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Subject Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                editTarget &&
                updateMutation.mutate({ id: editTarget.id, name, code })
              }
              disabled={updateMutation.isPending}
              className="rounded-xl"
            >
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Subject"
        description="Are you sure? This action cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
