"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { cohortsApi, groupsApi, parentGroupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CohortRow = {
  id: string;
  code: string;
  sortOrder: number;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type GroupRow = {
  id: string;
  name: string;
  cohort?: CohortRow | null;
  parentGroup?: DepartmentRow | null;
  _count?: { students?: number };
};

const FIXED_DEPARTMENTS = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
] as const;

export function GroupsTreeView({ lang, dict }: { lang: string; dict: any }) {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      groupsApi.list({ take: 5000 }).then((r) => r.data.data as GroupRow[]),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () =>
      cohortsApi.list({ take: 1000 }).then((r) => r.data.data as any[]),
    staleTime: 60_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () =>
      parentGroupsApi.list({ take: 1000 }).then((r) => r.data.data as any[]),
    staleTime: 60_000,
  });

  const deptByName = React.useMemo(() => {
    const map = new Map<string, DepartmentRow>();
    for (const d of (departments ?? []) as any[]) {
      if (d?.id && d?.name)
        map.set(String(d.name), { id: String(d.id), name: String(d.name) });
    }
    return map;
  }, [departments]);

  const groupsByDept = React.useMemo(() => {
    const out = new Map<string, GroupRow[]>();
    for (const g of groups ?? []) {
      const deptName = g.parentGroup?.name ?? "(No department)";
      const list = out.get(deptName) ?? [];
      list.push(g);
      out.set(deptName, list);
    }
    return out;
  }, [groups]);

  const orderedDepartments = FIXED_DEPARTMENTS.filter((name) =>
    deptByName.has(name),
  );
  const otherDepartments = Array.from(groupsByDept.keys())
    .filter((n) => !orderedDepartments.includes(n as any))
    .sort((a, b) => a.localeCompare(b));

  const renderDepartment = (deptName: string) => {
    const deptGroups = (groupsByDept.get(deptName) ?? []).slice();

    const groupsByCohortCode = new Map<string, GroupRow[]>();
    for (const g of deptGroups) {
      const cohortCode = g.cohort?.code ?? "(No cohort)";
      const list = groupsByCohortCode.get(cohortCode) ?? [];
      list.push(g);
      groupsByCohortCode.set(cohortCode, list);
    }

    const cohortCodes: string[] = Array.from(groupsByCohortCode.keys());

    const cohortMeta: Array<{ code: string; sortOrder: number }> =
      cohortCodes.map((code) => {
        const c = (cohorts ?? []).find(
          (x: any) => String(x?.code ?? "") === code,
        );
        return {
          code,
          sortOrder: Number(c?.sortOrder ?? 999),
        };
      });

    cohortMeta.sort((a, b) => {
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
              {deptGroups.length} groups
            </Badge>
          </div>

          <div className="space-y-3">
            {cohortMeta.map((c) => {
              const list = (groupsByCohortCode.get(c.code) ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));
              const badgeVariant = (
                c.sortOrder % 2 === 0 ? "secondary" : "outline"
              ) as any;

              return (
                <div key={c.code} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={badgeVariant}>{c.code}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {list.length} groups
                    </div>
                  </div>

                  <div className="divide-y rounded-md border">
                    {list.map((g) => (
                      <Link
                        key={g.id}
                        href={`/${lang}/dashboard/groups/${g.id}`}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{g.name}</div>
                          {typeof g._count?.students === "number" ? (
                            <Badge variant="outline" className="text-[10px]">
                              {g._count.students}{" "}
                              {dict?.nav?.students ?? "students"}
                            </Badge>
                          ) : null}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
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
    <div className="container space-y-4">
      <PageHeader title={dict?.nav?.groups ?? "Groups"} />

      {isLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : groups && groups.length ? (
        <div className="space-y-4">
          {orderedDepartments.map(renderDepartment)}
          {otherDepartments.map(renderDepartment)}
        </div>
      ) : (
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          No groups found. Seed DB or create groups in Cohorts.
        </div>
      )}
    </div>
  );
}
