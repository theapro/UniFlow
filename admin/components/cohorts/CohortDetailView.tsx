"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { cohortsApi, groupsApi, parentGroupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Department = { id: string; name: string };

type GroupRow = {
  id: string;
  name: string;
  parentGroup?: Department | null;
};

type CohortDetail = {
  id: string;
  code: string;
  sortOrder: number;
  year?: number | null;
  groups: GroupRow[];
};

const FIXED_DEPARTMENTS = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
] as const;

export function CohortDetailView({
  lang,
  dict,
  id,
}: {
  lang: string;
  dict: any;
  id: string;
}) {
  const queryClient = useQueryClient();

  const { data: cohort, isLoading } = useQuery({
    queryKey: ["cohorts", id],
    queryFn: () =>
      cohortsApi.getById(id).then((r) => r.data.data as CohortDetail),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () =>
      parentGroupsApi.list({ take: 1000 }).then((r) => r.data.data as any[]),
    staleTime: 60_000,
  });

  const deptByName = React.useMemo(() => {
    const map = new Map<string, Department>();
    for (const d of (departments ?? []) as any[]) {
      if (d?.id && d?.name)
        map.set(String(d.name), { id: String(d.id), name: String(d.name) });
    }
    return map;
  }, [departments]);

  const [draftByDept, setDraftByDept] = React.useState<Record<string, string>>(
    {},
  );

  const createGroupMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      parentGroupId: string;
      cohortId: string;
    }) => groupsApi.create(payload),
    onSuccess: async () => {
      toast.success(dict?.common?.success ?? "Created");
      setDraftByDept({});
      await queryClient.invalidateQueries({ queryKey: ["cohorts", id] });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create group",
      );
    },
  });

  if (isLoading || !cohort) {
    return (
      <div className="container">{dict?.common?.loading ?? "Loading..."}</div>
    );
  }

  const groups = Array.isArray(cohort.groups) ? cohort.groups : [];

  return (
    <div className="container space-y-4">
      <PageHeader
        title={`${dict?.nav?.cohorts ?? "Cohorts"}: ${cohort.code}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {FIXED_DEPARTMENTS.map((deptName) => {
          const dept = deptByName.get(deptName);
          const deptGroups = groups
            .filter((g) => (g.parentGroup?.name ?? null) === deptName)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name));

          return (
            <Card key={deptName}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{deptName}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {deptGroups.length} groups
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`newGroup:${deptName}`}>Add group</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`newGroup:${deptName}`}
                      value={draftByDept[deptName] ?? ""}
                      onChange={(e) =>
                        setDraftByDept((prev) => ({
                          ...prev,
                          [deptName]: e.target.value,
                        }))
                      }
                      placeholder={
                        deptName === "IT" ? "e.g. 23A" : "Group name"
                      }
                      disabled={!dept}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        const name = String(draftByDept[deptName] ?? "").trim();
                        if (!name || !dept) return;
                        createGroupMutation.mutate({
                          name,
                          parentGroupId: dept.id,
                          cohortId: cohort.id,
                        });
                      }}
                      disabled={
                        !dept ||
                        createGroupMutation.isPending ||
                        String(draftByDept[deptName] ?? "").trim().length === 0
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {!dept ? (
                    <div className="text-xs text-muted-foreground">
                      Department not seeded yet (run DB seed).
                    </div>
                  ) : null}
                </div>

                <div className="divide-y rounded-md border">
                  {deptGroups.length ? (
                    deptGroups.map((g) => (
                      <Link
                        key={g.id}
                        href={`/${lang}/dashboard/groups/${g.id}`}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                      >
                        <div className="font-medium">{g.name}</div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                      No groups
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
