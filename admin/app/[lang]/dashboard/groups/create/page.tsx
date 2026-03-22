"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { cohortsApi, groupsApi, parentGroupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function CreateGroupPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const [name, setName] = React.useState("");
  const [parentGroupId, setParentGroupId] = React.useState("none");
  const [cohortId, setCohortId] = React.useState("none");

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
      cohortId?: string | null;
      parentGroupId?: string | null;
    }) => groupsApi.create(payload),
    onSuccess: async () => {
      toast.success("Group created successfully");
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.push(`/${lang}/dashboard/groups`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to create group");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate({
      name,
      cohortId: cohortId === "none" ? null : cohortId,
      parentGroupId: parentGroupId === "none" ? null : parentGroupId,
    });
  };

  const canSubmit = Boolean(name.trim()) && !createMutation.isPending;

  return (
    <div className="container max-w-2xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/${lang}/dashboard/groups`}
          className="group flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Groups
        </Link>
      </div>

      <PageHeader
        title="Create New Group"
        description="Create a group and optionally link it to a department and cohort."
      />

      <Card className="shadow-sm border-none bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Group Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Name is required; department/cohort are optional.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Department (Optional)
                </Label>
                <Select value={parentGroupId} onValueChange={setParentGroupId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
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
                  Cohort (Optional)
                </Label>
                <Select value={cohortId} onValueChange={setCohortId}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cohort</SelectItem>
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
                Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. IT-101"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background"
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
                {createMutation.isPending ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
