"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cohortsApi, parentGroupsApi, subjectsApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
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
}: {
  params: { lang: string };
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [parentGroupId, setParentGroupId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => cohortsApi.list({ take: 1000 }).then((r) => r.data.data),
    staleTime: 60_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["parent-groups"],
    queryFn: () =>
      parentGroupsApi.list({ take: 1000 }).then((r) => r.data.data),
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
    if (!name.trim()) return;
    if (!parentGroupId || !cohortId) {
      toast.error("Select department and cohort");
      return;
    }
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
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create New Subject" />
      </div>

      <Card className="shadow-sm border-none bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Subject Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Provide the official name and an optional shorthand code for the
            subject.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select value={parentGroupId} onValueChange={setParentGroupId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Cohort <span className="text-destructive">*</span>
                </Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedCohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {cohortLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Subject Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Advanced Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold">
                Subject Code (Optional)
              </Label>
              <Input
                id="code"
                placeholder="e.g. MATH-401"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-background uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-muted">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Creating..." : "Create Subject"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
