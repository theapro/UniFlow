"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";

import { cohortsApi, parentGroupsApi, subjectsApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CohortRow = {
  id: string;
  code: string;
  sortOrder: number;
  year?: number | null;
};

type ParentGroupRow = {
  id: string;
  name: string;
};

const FIXED_DEPARTMENTS = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
] as const;

function cohortLabel(c: CohortRow) {
  return c.year ? `${c.code} (${c.year})` : c.code;
}

export default function CreateSubjectPage({
  params: { lang },
  dict, // Lug'at (dictionary) kelayotgan bo'lsa
}: {
  params: { lang: string };
  dict?: any;
}) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [parentGroupId, setParentGroupId] = React.useState("");
  const [cohortId, setCohortId] = React.useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => cohortsApi.list({ take: 1000 }).then((r) => r.data.data),
    staleTime: 60_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () => parentGroupsApi.list({ take: 1000 }).then((r) => r.data.data),
    staleTime: 60_000,
  });

  const sortedCohorts = ((cohorts ?? []) as any as CohortRow[])
    .slice()
    .sort((a, b) => {
      const r = Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999);
      if (r !== 0) return r;
      return String(a.code ?? "").localeCompare(String(b.code ?? ""));
    });

  const sortedDepartments = ((departments ?? []) as any as ParentGroupRow[])
    .slice()
    .sort((a, b) => {
      const ai = FIXED_DEPARTMENTS.indexOf(a.name as any);
      const bi = FIXED_DEPARTMENTS.indexOf(b.name as any);
      const aRank = ai >= 0 ? ai : 999;
      const bRank = bi >= 0 ? bi : 999;
      if (aRank !== bRank) return aRank - bRank;
      return a.name.localeCompare(b.name);
    });

  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      code?: string | null;
      cohortId: string;
      parentGroupId: string;
    }) => subjectsApi.create(payload),
    onSuccess: async () => {
      toast.success("Subject created successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      router.push(`/${lang}/dashboard/subjects`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create subject");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate({
      name,
      code: code || null,
      parentGroupId,
      cohortId,
    });
  };

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(parentGroupId) &&
    Boolean(cohortId) &&
    !createMutation.isPending;

  return (
    <div className="container max-w-7xl py-10 space-y-8 animate-in fade-in duration-500">
      
      {/* Top Navigation & Breadcrumb Style Header */}
      <div className="flex items-center gap-4 px-1">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all shadow-sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">
             New Registration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white/90 leading-none">
            Create Subject
          </h1>
        </div>
      </div>

      <Card className="rounded-[32px] border-border/40 bg-muted/10 backdrop-blur-md shadow-none overflow-hidden">
        <CardContent className="p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-10">
            
            {/* Form Section: Primary Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">Core Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Subject Name *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-2xl border-border/40 bg-background/40 px-4 focus:ring-primary/20 transition-all"
                    placeholder="e.g. Advanced Mathematics"
                    required
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Subject Code
                  </Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="h-12 rounded-2xl border-border/40 bg-background/40 px-4 font-mono transition-all"
                    placeholder="MATH101"
                  />
                </div>
              </div>
            </div>

            {/* Form Section: Academic Context */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">Academic Placement</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Department *
                  </Label>
                  <Select value={parentGroupId} onValueChange={setParentGroupId}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-background/40 px-4 transition-all">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                      {sortedDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="rounded-xl cursor-pointer">
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Cohort *
                  </Label>
                  <Select value={cohortId} onValueChange={setCohortId}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-background/40 px-4 transition-all">
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                      {sortedCohorts.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-xl cursor-pointer">
                          {cohortLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/[0.05]">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
                className="rounded-2xl h-12 px-8 hover:bg-white/5 transition-colors"
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl h-12 px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-all shadow-lg shadow-primary/20"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Subject
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}