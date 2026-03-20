"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronRight } from "lucide-react";

import { gradesSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";

type TabItem = {
  sheetTitle: string;
  groupName: string;
  subjectName: string;
};

type TabsResponse = { items: TabItem[] };

export function GradesTabsView({ lang, dict }: { lang: string; dict: any }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["grades-sheets", "tabs"],
    queryFn: () =>
      gradesSheetsApi.tabs().then((r) => r.data.data as TabsResponse),
    staleTime: 30_000,
  });

  const tabs = data?.items ?? [];

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.grades?.title ?? "Grades"}
        description={
          dict?.grades?.tabsDescription ??
          "Admin can preview Grades (Baholash) tabs; teachers fill grades directly in Google Sheets."
        }
      />

      {isLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : isError ? (
        <EmptyState
          icon={ClipboardList}
          title={dict?.common?.errorTitle ?? "Could not load"}
          description={
            (error as any)?.response?.data?.message ??
            (error as any)?.message ??
            "Failed to load grades tabs"
          }
        />
      ) : tabs.length ? (
        <section className="rounded-[32px] border border-border/40 bg-muted/10 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tabs.map((t) => {
              const href = `/${lang}/dashboard/grades/${encodeURIComponent(
                t.sheetTitle,
              )}/view`;

              return (
                <Link key={t.sheetTitle} href={href} className="block">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/50 p-4 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium truncate">
                          {t.groupName} / {t.subjectName}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-border/40"
                        >
                          {dict?.grades?.tab ?? "Tab"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {t.sheetTitle}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={dict?.grades?.noTabsTitle ?? "No grades tabs"}
          description={
            dict?.grades?.noTabsDescription ??
            "Create an Attendance tab (with assignment count) to auto-generate a matching Grades tab."
          }
        />
      )}
    </div>
  );
}
