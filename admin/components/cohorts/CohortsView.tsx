"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  Plus,
  UserRound,
} from "lucide-react";

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

type CohortRow = {
  id: string;
  code: string;
  sortOrder: number;
};

type GroupRow = {
  id: string;
  name: string;
  cohortId?: string;
  cohort?: { id: string; code: string };
  _count?: { students?: number };
};

export function CohortsView({ lang, dict }: { lang: string; dict: any }) {
  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () =>
      cohortsApi.list({ take: 500 }).then((r) => r.data.data as CohortRow[]),
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: () =>
      groupsApi.list({ take: 5000 }).then((r) => r.data.data as GroupRow[]),
  });

  // Cohortlarni tartiblash
  const sortedCohorts = React.useMemo(() => {
    return [...(cohorts ?? [])].sort(
      (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
    );
  }, [cohorts]);

  return (
    <div className="container max-w-7xl py-10 space-y-10">
      <PageHeader
        title={dict?.nav?.cohorts ?? "Academic Cohorts"}
        description="Browse student groups organized by academic cohorts"
        actions={
          <Button asChild className="gap-2 rounded-2xl">
            <Link href={`/${lang}/dashboard/cohorts/create`}>
              <Plus className="size-4" />
              {dict?.common?.create ?? "Create Cohort"}
            </Link>
          </Button>
        }
      />

      {cohortsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-[28px] bg-white/5 border border-white/5"
            />
          ))}
        </div>
      ) : (
        /* type="single" va collapsible barcha accordionlar yopiq holda chiqishini ta'minlaydi */
        <Accordion type="single" collapsible className="space-y-4">
          {sortedCohorts.map((cohort) => {
            const cohortGroups =
              groups?.filter((g) => g.cohortId === cohort.id) ?? [];

            return (
              <AccordionItem
                key={cohort.id}
                value={cohort.id}
                className="border-none bg-muted/10 rounded-[32px] px-6 transition-all data-[state=open]:bg-muted/20 border border-transparent data-[state=open]:border-border/40"
              >
                <AccordionTrigger className="hover:no-underline py-7 group">
                  <div className="flex items-center gap-5 text-left">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50 border border-border/40 text-muted-foreground group-hover:text-primary group-hover:border-primary/30 transition-all duration-300">
                      <GraduationCap className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-bold tracking-tight text-foreground/90">
                        Cohort {cohort.code}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        {cohortGroups.length} Units Available
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="pb-8 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-8 pt-4">
                    {/* Rasmdagi separator qismi */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1 border border-border/40">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-bold tracking-wider uppercase text-foreground/80">
                          {cohort.code}
                        </span>
                      </div>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-border/60 to-transparent" />
                    </div>

                    {/* Groups Grid */}
                    {cohortGroups.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {cohortGroups.map((group) => (
                          <Link
                            key={group.id}
                            href={`/${lang}/dashboard/groups/${group.id}`}
                            className={cn(
                              "group relative flex items-center justify-between overflow-hidden rounded-2xl",
                              "border border-border/40 bg-muted/20 p-5 transition-all duration-300",
                              "hover:border-primary/30 hover:bg-muted/40 hover:shadow-2xl hover:shadow-primary/5",
                              "active:scale-[0.98]",
                            )}
                          >
                            <div className="relative z-10 space-y-2">
                              <h4 className="text-[15px] font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                                {group.name}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <UserRound className="h-3.5 w-3.5" />
                                <span>
                                  {group._count?.students ?? 0} Students
                                </span>
                              </div>
                            </div>
                            <div className="rounded-full bg-primary/10 p-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                              <ArrowUpRight className="h-4 w-4 text-primary" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 text-center rounded-[24px] border border-dashed border-border/40 bg-muted/10">
                        <p className="text-sm text-muted-foreground italic">
                          No groups found in this cohort
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
