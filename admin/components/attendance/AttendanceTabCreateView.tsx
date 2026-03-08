"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { attendanceSheetsApi, groupsApi, subjectsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCalendar } from "@/components/attendance/MultiSelectCalendar";

type GroupLike = { id: string; name: string };
type SubjectLike = { id: string; name: string };

type CreateTabResponse = {
  sheetTitle: string;
  createdTab: boolean;
  addedDates: number;
};

export function AttendanceTabCreateView({
  lang,
  dict,
}: {
  lang: string;
  dict: any;
}) {
  const router = useRouter();

  const [groupId, setGroupId] = React.useState<string>("");
  const [subjectId, setSubjectId] = React.useState<string>("");
  const [dates, setDates] = React.useState<string[]>([]);

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const res = await groupsApi.list({ take: 1000, skip: 0 });
      return (res.data?.data ?? []) as GroupLike[];
    },
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await subjectsApi.list({ take: 1000, skip: 0 });
      return (res.data?.data ?? []) as SubjectLike[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !subjectId) throw new Error("MISSING_GROUP_SUBJECT");
      if (!dates.length) throw new Error("MISSING_DATES");

      const res = await attendanceSheetsApi.createTab({
        groupId,
        subjectId,
        dates,
      });
      return res.data.data as CreateTabResponse;
    },
    onSuccess: (data) => {
      toast.success(
        data.createdTab
          ? (dict?.attendance?.createSuccess ?? "Attendance tab created")
          : (dict?.attendance?.updateSuccess ?? "Attendance tab updated"),
      );
      router.push(
        `/${lang}/dashboard/attendance/${encodeURIComponent(
          data.sheetTitle,
        )}/view`,
      );
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Failed to create attendance tab";
      toast.error(msg);
    },
  });

  const groups = groupsQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];

  return (
    <div className="container space-y-4">
      <PageHeader
        title={dict?.attendance?.createTab ?? "Create attendance tab"}
        description={
          dict?.attendance?.createHint ??
          "Select group + subject, then pick lesson days on the calendar. Teachers will mark attendance in Google Sheets."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{dict?.attendance?.tabInfo ?? "Tab details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {dict?.schedule?.group ?? "Group"}
              </div>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder={dict?.schedule?.group ?? "Group"} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">
                {dict?.schedule?.subject ?? "Subject"}
              </div>
              <Select
                value={subjectId}
                onValueChange={setSubjectId}
                disabled={!groupId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={dict?.schedule?.subject ?? "Subject"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {dict?.attendance?.lessonDays ?? "Lesson days"}
            </div>
            <MultiSelectCalendar value={dates} onChange={setDates} />
            <div className="text-xs text-muted-foreground">
              {dict?.attendance?.lessonDaysHint ??
                "Click dates to select multiple days. These will become date columns in the Sheet."}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                !groupId ||
                !subjectId ||
                dates.length === 0
              }
            >
              {createMutation.isPending
                ? (dict?.common?.loading ?? "Saving...")
                : (dict?.common?.create ?? "Create")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
