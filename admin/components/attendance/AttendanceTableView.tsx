"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { attendanceApi, groupsApi, studentsApi, subjectsApi } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

type GroupLike = { id: string; name: string };

type SubjectLike = { id: string; name: string };

type StudentLike = {
  id: string;
  fullName: string;
  studentNumber?: string | null;
};

type AttendanceLike = {
  id: string;
  status: AttendanceStatus;
  studentId: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function AttendanceTableView({
  labels,
}: {
  labels: {
    title: string;
    groupLabel: string;
    subjectLabel: string;
    dateLabel: string;
    studentLabel: string;
    statusLabel: string;
    present: string;
    absent: string;
    late: string;
    excused: string;
  };
}) {
  const qc = useQueryClient();

  const [groupId, setGroupId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [date, setDate] = useState<string>(() => toDateInputValue(new Date()));

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

  const studentsQuery = useQuery({
    queryKey: ["students", groupId],
    enabled: Boolean(groupId),
    queryFn: async () => {
      const res = await studentsApi.list({ groupId, take: 1000, skip: 0 });
      return (res.data?.data ?? []) as StudentLike[];
    },
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendanceByDate", { groupId, subjectId, date }],
    enabled: Boolean(groupId && subjectId && date),
    queryFn: async () => {
      const res = await attendanceApi.getByDate({ groupId, subjectId, date });
      return (res.data?.data ?? []) as AttendanceLike[];
    },
  });

  const existingByStudentId = useMemo(() => {
    const map = new Map<string, AttendanceLike>();
    for (const record of attendanceQuery.data ?? []) {
      if (record?.studentId) map.set(record.studentId, record);
    }
    return map;
  }, [attendanceQuery.data]);

  const [draft, setDraft] = useState<Record<string, AttendanceStatus | "">>({});

  useEffect(() => {
    const students = studentsQuery.data ?? [];
    const next: Record<string, AttendanceStatus | ""> = {};

    for (const student of students) {
      const existing = existingByStudentId.get(student.id);
      next[student.id] = existing?.status ?? "";
    }

    setDraft(next);
  }, [studentsQuery.data, existingByStudentId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !subjectId || !date) throw new Error("MISSING_FILTERS");

      const students = studentsQuery.data ?? [];
      const records: { studentId: string; status: AttendanceStatus | "" }[] =
        [];

      for (const student of students) {
        const nextStatus = draft[student.id] ?? "";
        records.push({ studentId: student.id, status: nextStatus });
      }

      await attendanceApi.bulkMarkByDate({ groupId, subjectId, date, records });
    },
    onSuccess: async () => {
      toast.success("Attendance saved");
      await qc.invalidateQueries({
        queryKey: ["attendanceByDate", { groupId, subjectId, date }],
      });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Failed to save";
      toast.error(msg);
    },
  });

  const groups = groupsQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const students = studentsQuery.data ?? [];

  const isLoading =
    groupsQuery.isLoading ||
    subjectsQuery.isLoading ||
    studentsQuery.isLoading ||
    attendanceQuery.isLoading;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">{labels.groupLabel}</div>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder={labels.groupLabel} />
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
              <div className="text-sm font-medium">{labels.subjectLabel}</div>
              <Select
                value={subjectId}
                onValueChange={setSubjectId}
                disabled={!groupId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={labels.subjectLabel} />
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

            <div className="space-y-2">
              <div className="text-sm font-medium">{labels.dateLabel}</div>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!groupId || !subjectId}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={
                !groupId ||
                !subjectId ||
                !date ||
                saveMutation.isPending ||
                isLoading
              }
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.statusLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {!groupId || !subjectId || !date ? (
            <p className="text-sm text-muted-foreground">
              Select group, subject, and date to edit attendance.
            </p>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students found for this group.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labels.studentLabel}</TableHead>
                    <TableHead className="w-[220px]">
                      {labels.statusLabel}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.fullName}</div>
                        {s.studentNumber ? (
                          <div className="text-xs text-muted-foreground">
                            {s.studentNumber}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={draft[s.id] ?? ""}
                          onValueChange={(value) => {
                            setDraft((prev) => ({
                              ...prev,
                              [s.id]: (value as AttendanceStatus | "") ?? "",
                            }));
                          }}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">—</SelectItem>
                            <SelectItem value="PRESENT">
                              {labels.present}
                            </SelectItem>
                            <SelectItem value="ABSENT">
                              {labels.absent}
                            </SelectItem>
                            <SelectItem value="LATE">{labels.late}</SelectItem>
                            <SelectItem value="EXCUSED">
                              {labels.excused}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
