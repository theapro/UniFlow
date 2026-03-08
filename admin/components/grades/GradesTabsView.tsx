"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ChevronRight } from "lucide-react";

import { gradesSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="container space-y-4">
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
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tabs.map((t) => {
                const href = `/${lang}/dashboard/grades/${encodeURIComponent(
                  t.sheetTitle,
                )}/view`;

                return (
                  <Link key={t.sheetTitle} href={href} className="block">
                    <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium">
                            {t.groupName} / {t.subjectName}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
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
          </CardContent>
        </Card>
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
