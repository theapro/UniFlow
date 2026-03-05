"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { lessonsApi } from "@/lib/api";
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

type LessonLike = {
  id: string;
  startsAt: string;
  endsAt: string;
  room?: string | null;
  group?: { id: string; name: string };
  subject?: { id: string; name: string };
  teacher?: { id: string; fullName: string };
  groupName?: string;
  subjectName?: string;
  teacherName?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toMonthValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function toDayKeyLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function toTimeHHMM(date: Date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function getMonthRange(monthValue: string): { from: string; to: string } {
  const [y, m] = monthValue.split("-").map((x) => Number.parseInt(x, 10));
  const year = Number.isFinite(y) ? y : new Date().getFullYear();
  const month = Number.isFinite(m) ? m : new Date().getMonth() + 1;
  const from = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function getDisplayFields(lesson: LessonLike) {
  const groupName = lesson.group?.name ?? String(lesson.groupName ?? "").trim();
  const subjectName =
    lesson.subject?.name ?? String(lesson.subjectName ?? "").trim();
  const teacherName =
    lesson.teacher?.fullName ?? String(lesson.teacherName ?? "").trim();
  const room = lesson.room ?? null;
  return { groupName, subjectName, teacherName, room };
}

export function ScheduleViewer() {
  const [month, setMonth] = useState(() => toMonthValue(new Date()));
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lessons, setLessons] = useState<LessonLike[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem("schedule:lastImportedMonth");
    if (last && /^\d{4}-\d{2}$/.test(last)) setMonth(last);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && /^\d{4}-\d{2}$/.test(detail)) {
        setMonth(detail);
      }
    };

    window.addEventListener("schedule:lastImportedMonth", handler);
    return () => {
      window.removeEventListener("schedule:lastImportedMonth", handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("schedule:lastImportedMonth", month);
    }
  }, [month]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const { from, to } = getMonthRange(month);
        const res = await lessonsApi.list({ from, to, take: 5000 });
        const list = (res.data?.data ?? []) as LessonLike[];

        if (!active) return;
        setLessons(list);

        const days = Array.from(
          new Set(
            list
              .map((l) => toDayKeyLocal(new Date(l.startsAt)))
              .filter(Boolean),
          ),
        ).sort();

        setSelectedDay((prev) => {
          if (prev && days.includes(prev)) return prev;
          return days[0] ?? "";
        });
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message ?? "Failed to load lessons");
        setLessons([]);
        setSelectedDay("");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [month]);

  const { days, groupNames, slots, grid } = useMemo(() => {
    const allDays = Array.from(
      new Set(lessons.map((l) => toDayKeyLocal(new Date(l.startsAt)))),
    )
      .filter(Boolean)
      .sort();

    const groups = Array.from(
      new Set(
        lessons
          .map((l) => getDisplayFields(l).groupName)
          .filter((n) => n && n.trim()),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const dayLessons = selectedDay
      ? lessons.filter(
          (l) => toDayKeyLocal(new Date(l.startsAt)) === selectedDay,
        )
      : [];

    const timeSlots = Array.from(
      new Set(
        dayLessons
          .map((l) => {
            const s = new Date(l.startsAt);
            const e = new Date(l.endsAt);
            return `${toTimeHHMM(s)}-${toTimeHHMM(e)}`;
          })
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const map = new Map<string, LessonLike[]>();
    for (const l of dayLessons) {
      const { groupName } = getDisplayFields(l);
      if (!groupName) continue;
      const s = new Date(l.startsAt);
      const e = new Date(l.endsAt);
      const slot = `${toTimeHHMM(s)}-${toTimeHHMM(e)}`;
      const key = `${slot}@@${groupName}`;
      const existing = map.get(key);
      if (existing) existing.push(l);
      else map.set(key, [l]);
    }

    return { days: allDays, groupNames: groups, slots: timeSlots, grid: map };
  }, [lessons, selectedDay]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Month</div>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-[180px]"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Day</div>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
              <SelectTrigger className="w-[220px]">
                <SelectValue
                  placeholder={days.length ? "Select day" : "No data"}
                />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : null}
        </div>

        {!selectedDay ? (
          <div className="text-sm text-muted-foreground">
            No lessons found for this month.
          </div>
        ) : null}

        {selectedDay && slots.length ? (
          <div className="w-full overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">Time</TableHead>
                  {groupNames.map((g) => (
                    <TableHead key={g} className="min-w-[160px]">
                      {g}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((slot) => (
                  <TableRow key={slot}>
                    <TableCell className="font-medium">{slot}</TableCell>
                    {groupNames.map((g) => {
                      const key = `${slot}@@${g}`;
                      const cellLessons = grid.get(key) ?? [];
                      return (
                        <TableCell key={g} className="align-top">
                          {cellLessons.length ? (
                            <div className="space-y-2">
                              {cellLessons.map((l) => {
                                const { subjectName, teacherName, room } =
                                  getDisplayFields(l);
                                return (
                                  <div key={l.id} className="text-sm">
                                    <div className="font-medium">
                                      {subjectName || "(No subject)"}
                                    </div>
                                    {room ? (
                                      <div className="text-muted-foreground">
                                        {room}
                                      </div>
                                    ) : null}
                                    {teacherName ? (
                                      <div className="text-muted-foreground">
                                        {teacherName}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
