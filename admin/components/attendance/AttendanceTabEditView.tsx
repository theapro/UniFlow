"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attendanceSheetsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { MultiSelectCalendar } from "@/components/attendance/MultiSelectCalendar";

type TabItem = {
  sheetTitle: string;
  groupName: string;
  subjectName: string;
  groupId: string | null;
  subjectId: string | null;
};

type TabsResponse = { items: TabItem[] };

type EnsureResponse = {
  sheetTitle: string;
  createdTab: boolean;
  addedDates: number;
};

export function AttendanceTabEditView({
  lang,
  dict,
  sheetTitle,
}: {
  lang: string;
  dict: any;
  sheetTitle: string;
}) {
  const qc = useQueryClient();

  const [dates, setDates] = React.useState<string[]>([]);

  const tabsQuery = useQuery({
    queryKey: ["attendance-sheets", "tabs"],
    queryFn: () =>
      attendanceSheetsApi.tabs().then((r) => r.data.data as TabsResponse),
    staleTime: 30_000,
  });

  const tab = React.useMemo(() => {
    const items = tabsQuery.data?.items ?? [];
    return items.find((t) => t.sheetTitle === sheetTitle) ?? null;
  }, [tabsQuery.data, sheetTitle]);

  const ensureMutation = useMutation({
    mutationFn: async () => {
      if (!tab?.groupId || !tab?.subjectId) throw new Error("TAB_UNMAPPED");
      if (!dates.length) throw new Error("MISSING_DATES");

      const res = await attendanceSheetsApi.createTab({
        groupId: tab.groupId,
        subjectId: tab.subjectId,
        dates,
      });
      return res.data.data as EnsureResponse;
    },
    onSuccess: async (data) => {
      toast.success(
        data.addedDates
          ? (dict?.attendance?.updateSuccess ?? "Lesson days added")
          : (dict?.attendance?.noChanges ?? "No changes"),
      );
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["attendance-sheets", "preview", sheetTitle],
        }),
        qc.invalidateQueries({ queryKey: ["attendance-sheets", "tabs"] }),
      ]);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Failed to update tab";
      toast.error(msg);
    },
  });

  const title = dict?.attendance?.editTab ?? "Edit attendance tab";

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={title}
        description={sheetTitle}
        actions={
          <Button variant="outline" asChild className="rounded-2xl">
            <Link
              href={`/${lang}/dashboard/attendance/${encodeURIComponent(
                sheetTitle,
              )}/view`}
            >
              {dict?.common?.back ?? "Back"}
            </Link>
          </Button>
        }
      />

      <section className="rounded-[32px] border border-border/40 bg-muted/10 p-6 space-y-4">
        <div className="text-lg font-semibold">
          {dict?.attendance?.lessonDays ?? "Lesson days"}
        </div>

        {!tab ? (
          <div className="text-sm text-muted-foreground">
            {dict?.common?.loading ?? "Loading..."}
          </div>
        ) : !tab.groupId || !tab.subjectId ? (
          <div className="text-sm text-destructive">
            {dict?.attendance?.unmappedEditHint ??
              "This tab is not mapped to an existing Group/Subject in DB, so it can’t be edited here."}
          </div>
        ) : (
          <>
            <div className="text-sm text-muted-foreground">
              {tab.groupName} / {tab.subjectName}
            </div>

            <MultiSelectCalendar value={dates} onChange={setDates} />

            <div className="flex justify-end gap-2">
              <Button
                onClick={() => ensureMutation.mutate()}
                disabled={ensureMutation.isPending || dates.length === 0}
                className="rounded-2xl"
              >
                {ensureMutation.isPending
                  ? (dict?.common?.loading ?? "Saving...")
                  : (dict?.attendance?.addDays ?? "Add selected days")}
              </Button>
            </div>
          </>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        {dict?.attendance?.editHint ??
          "Editing only adds missing date columns (it won’t delete existing columns)."}
      </div>
    </div>
  );
}
