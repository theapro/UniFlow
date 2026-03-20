"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users, LayoutGrid, Layers, Plus } from "lucide-react";

import { cohortsApi, groupsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// --- Types ---
type GroupRow = {
  id: string;
  name: string;
  cohort?: { id: string; code: string; sortOrder: number } | null;
  parentGroup?: { id: string; name: string } | null;
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
  // --- Data Fetching ---
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

  // --- Logic ---
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

  const allDepts = React.useMemo(() => {
    const existing = Array.from(groupsByDept.keys());
    const ordered = FIXED_DEPARTMENTS.filter((name) => existing.includes(name));
    const others = existing
      .filter((n) => !FIXED_DEPARTMENTS.includes(n as any))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...others];
  }, [groupsByDept]);

  // --- Renderers ---
  const renderGroups = (deptName: string) => {
    const deptGroups = groupsByDept.get(deptName) ?? [];
    const groupsByCohort = new Map<string, GroupRow[]>();

    for (const g of deptGroups) {
      const code = g.cohort?.code ?? "(No cohort)";
      const list = groupsByCohort.get(code) ?? [];
      list.push(g);
      groupsByCohort.set(code, list);
    }

    const sortedCohorts = Array.from(groupsByCohort.keys()).sort((a, b) => {
      const metaA = cohorts?.find((x) => x.code === a);
      const metaB = cohorts?.find((x) => x.code === b);
      return (
        (metaA?.sortOrder ?? 999) - (metaB?.sortOrder ?? 999) ||
        a.localeCompare(b)
      );
    });

    return (
      <div className="space-y-10 py-4 px-1">
        {sortedCohorts.map((code) => (
          <div key={code} className="group/cohort space-y-5">
            {/* Minimalistic Cohort Divider */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1 border border-border/40">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-foreground/80">
                  {code}
                </span>
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-border/60 to-transparent" />
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupsByCohort.get(code)?.map((g) => (
                <Link
                  key={g.id}
                  href={`/${lang}/dashboard/groups/${g.id}`}
                  className={cn(
                    "group relative flex items-center justify-between overflow-hidden rounded-2xl",
                    "border border-border/40 bg-muted/20 p-5 transition-all duration-300",
                    "hover:border-primary/30 hover:bg-muted/40 hover:shadow-2xl hover:shadow-primary/5",
                    "active:scale-[0.98]",
                  )}
                >
                  <div className="relative z-10 space-y-2">
                    <h4 className="text-[15px] font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                      {g.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="flex -space-x-1">
                        <Users className="h-3.5 w-3.5 mr-1" />
                      </div>
                      <span className="font-medium">
                        {g._count?.students ?? 0}{" "}
                        {dict?.nav?.students ?? "students"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-primary/10 p-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <ChevronRight className="h-4 w-4 text-primary" />
                  </div>
                </Link>
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
        title={dict?.nav?.groups ?? "Groups Explorer"}
        description="Browse student groups organized by department and cohorts"
        actions={
          <Button asChild className="gap-2 rounded-2xl">
            <Link href={`/${lang}/dashboard/groups/create`}>
              <Plus className="size-4" />
              {dict?.common?.create ?? "Create Group"}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 w-full animate-pulse rounded-3xl bg-muted/20 border border-border/20"
            />
          ))}
        </div>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={[allDepts[0]]}
          className="space-y-5"
        >
          {allDepts.map((dept) => (
            <AccordionItem
              key={dept}
              value={dept}
              className="border-none bg-muted/10 rounded-[32px] px-6 transition-all data-[state=open]:bg-muted/20 border border-transparent data-[state=open]:border-border/40"
            >
              <AccordionTrigger className="hover:no-underline py-7 group">
                <div className="flex items-center gap-5 text-left">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50 border border-border/40 text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all duration-300">
                    <LayoutGrid className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-lg font-bold tracking-tight text-foreground/90">
                      {dept}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                      {(groupsByDept.get(dept) ?? []).length} Units Available
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-8">
                {renderGroups(dept)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
