"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { cohortsApi, parentGroupsApi, subjectsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Subject = {
  id: string;
  name: string;
  code: string | null;
  cohortId?: string | null;
  parentGroupId?: string | null;
  cohort?: {
    id: string;
    code: string;
    sortOrder: number;
    year?: number | null;
  } | null;
  parentGroup?: { id: string; name: string } | null;
};

export function SubjectEditView({
  lang,
  dict,
  id,
}: {
  lang: string;
  dict: any;
  id: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [parentGroupId, setParentGroupId] = React.useState("");
  const [cohortId, setCohortId] = React.useState("");

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

  const { data: subject, isLoading } = useQuery({
    queryKey: ["subjects", id],
    queryFn: () => subjectsApi.getById(id).then((r) => r.data.data as Subject),
  });

  React.useEffect(() => {
    if (!subject) return;
    setName(subject.name ?? "");
    setCode(subject.code ?? "");
    setParentGroupId(subject.parentGroup?.id ?? subject.parentGroupId ?? "");
    setCohortId(subject.cohort?.id ?? subject.cohortId ?? "");
  }, [subject]);

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      code?: string | null;
      cohortId: string;
      parentGroupId: string;
    }) => subjectsApi.update(id, payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Updated successfully");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subjects"] }),
        queryClient.invalidateQueries({ queryKey: ["subjects", id] }),
      ]);
      router.push(`/${lang}/dashboard/subjects/${id}/view`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to update subject");
    },
  });

  const canSubmit =
    name.trim().length > 0 &&
    Boolean(parentGroupId) &&
    Boolean(cohortId) &&
    !updateMutation.isPending;

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <Link
        href={`/${lang}/dashboard/subjects/${id}/view`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
      >
        <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
        {dict?.common?.back ?? "Back"}
      </Link>

      <PageHeader title={dict?.subjects?.editTitle ?? "Edit Subject"} />

      <Card className="shadow-sm border-none bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">
            {dict?.subjects?.details ?? "Subject Details"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {dict?.subjects?.editHint ??
              "Changes will be synced to Google Sheets when sync is enabled."}
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              updateMutation.mutate({
                name: name.trim(),
                code: code.trim() ? code.trim() : null,
                parentGroupId,
                cohortId,
              });
            }}
            className="space-y-6"
          >
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
                {dict?.subjects?.name ?? "Subject Name"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold">
                {dict?.subjects?.code ?? "Subject Code"}
              </Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-background uppercase"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-muted">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={updateMutation.isPending}
              >
                {dict?.common?.cancel ?? "Cancel"}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending
                  ? (dict?.common?.loading ?? "Saving...")
                  : (dict?.common?.save ?? "Save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
