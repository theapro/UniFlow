"use client";

import * as React from "react";
import Link from "next/link";
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

export function SubjectEditView({ lang, dict, id }: { lang: string; dict: any; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [parentGroupId, setParentGroupId] = React.useState("");
  const [cohortId, setCohortId] = React.useState("");

  // Queries
  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => cohortsApi.list({ take: 1000 }).then((r) => r.data.data),
  });

  const { data: departments } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () => parentGroupsApi.list({ take: 1000 }).then((r) => r.data.data),
  });

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subjects", id],
    queryFn: () => subjectsApi.getById(id).then((r) => r.data.data),
  });

  React.useEffect(() => {
    if (subject) {
      setName(subject.name ?? "");
      setCode(subject.code ?? "");
      setParentGroupId(subject.parentGroup?.id ?? subject.parentGroupId ?? "");
      setCohortId(subject.cohort?.id ?? subject.cohortId ?? "");
    }
  }, [subject]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => subjectsApi.update(id, payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated successfully");
      await queryClient.invalidateQueries({ queryKey: ["subjects"] });
      router.push(`/${lang}/dashboard/subjects/${id}/view`);
    },
  });

  const canSubmit = name.trim().length > 0 && parentGroupId && cohortId && !updateMutation.isPending;

  return (
    <div className="container max-w-7xl py-10 space-y-8 animate-in fade-in duration-500">
      
      {/* Top Navigation */}
      <div className="flex items-center gap-4 px-1">
        <Link
          href={`/${lang}/dashboard/subjects/${id}/view`}
          className="group flex h-10 w-10 items-center justify-center rounded-xl border border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
        >
          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 leading-none mb-1">
            {dict?.subjects?.editTitle ?? "Edit Mode"}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white/90 leading-none">
            {subject?.name || "..."}
          </h1>
        </div>
      </div>

      <Card className="rounded-[32px] border-border/40 bg-muted/10 backdrop-blur-md shadow-none overflow-hidden">
        <CardContent className="p-8 md:p-12">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) updateMutation.mutate({ name, code, parentGroupId, cohortId });
            }}
            className="space-y-10"
          >
            {/* Form Section: Primary Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/50">Core Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <Label htmlFor="name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    {dict?.subjects?.name ?? "Subject Name"} *
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-2xl border-border/40 bg-background/40 px-4 focus:ring-primary/20 transition-all"
                    placeholder="e.g. Advanced Mathematics"
                  />
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="code" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    {dict?.subjects?.code ?? "Subject Code"}
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
                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-background/40 px-4">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                      {(departments || []).map((d: any) => (
                        <SelectItem key={d.id} value={d.id} className="rounded-xl">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 ml-1">
                    Cohort *
                  </Label>
                  <Select value={cohortId} onValueChange={setCohortId}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/40 bg-background/40 px-4">
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/40 backdrop-blur-xl">
                      {(cohorts || []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-xl">
                          {c.code} {c.year ? `(${c.year})` : ""}
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
                className="rounded-2xl h-12 px-8 hover:bg-white/5"
              >
                {dict?.common?.cancel ?? "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl h-12 px-10 bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {dict?.common?.save ?? "Save Changes"}
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