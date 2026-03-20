"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ChevronRight } from "lucide-react";

import { attendanceSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TabItem = {
  sheetTitle: string;
  groupName: string;
  subjectName: string;
  groupId: string | null;
  subjectId: string | null;
};

type TabsResponse = { items: TabItem[] };

export function AttendanceTabsView({
  lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance-sheets", "tabs"],
    queryFn: () =>
      attendanceSheetsApi.tabs().then((r) => r.data.data as TabsResponse),
    staleTime: 30_000,
  });

  const tabs = data?.items ?? [];

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.attendance?.title ?? "Attendance"}
        description={
          dict?.attendance?.tabsDescription ??
          "Admin generates Attendance tabs and lesson days; teachers mark attendance in Google Sheets."
        }
        actions={
          <Button asChild className="rounded-2xl">
            <Link href={`/${lang}/dashboard/attendance/create`}>
              {dict?.attendance?.createTab ?? "Create attendance tab"}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div>{dict?.common?.loading ?? "Loading..."}</div>
      ) : isError ? (
        <EmptyState
          icon={ClipboardCheck}
          title={dict?.common?.errorTitle ?? "Could not load"}
          description={
            (error as any)?.response?.data?.message ??
            (error as any)?.message ??
            "Failed to load attendance tabs"
          }
        />
      ) : tabs.length ? (
        <section className="rounded-[32px] border border-border/40 bg-muted/10 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tabs.map((t) => {
              const href = `/${lang}/dashboard/attendance/${encodeURIComponent(
                t.sheetTitle,
              )}/view`;
              const unmapped = !t.groupId || !t.subjectId;

              return (
                <Link key={t.sheetTitle} href={href} className="block">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/50 p-4 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium truncate">
                          {t.groupName} / {t.subjectName}
                        </div>
                        {unmapped ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {dict?.attendance?.unmapped ?? "Unmapped"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {dict?.attendance?.tab ?? "Tab"}
                          </Badge>
                        )}
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
          icon={ClipboardCheck}
          title={dict?.attendance?.noTabsTitle ?? "No attendance tabs"}
          description={
            dict?.attendance?.noTabsDescription ??
            "Create an attendance tab for a group + subject to start taking attendance in Sheets."
          }
        />
      )}
    </div>
  );
}
