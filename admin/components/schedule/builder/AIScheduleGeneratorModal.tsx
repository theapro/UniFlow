"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { aiScheduleApi } from "@/lib/api";
import { useScheduleBuilder } from "./route/ScheduleBuilderContext";

type IdName = { id: string; name: string };

type Teacher = { id: string; fullName: string };

type RequirementRow = {
  groupId: string;
  subjectId: string;
  teacherId: string;
  roomId: string | null;
  lessons: string;
};

type WeekdayKey = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

const WEEKDAYS: Array<{ key: WeekdayKey; label: string; value: number }> = [
  { key: "MON", label: "Mon", value: 1 },
  { key: "TUE", label: "Tue", value: 2 },
  { key: "WED", label: "Wed", value: 3 },
  { key: "THU", label: "Thu", value: 4 },
  { key: "FRI", label: "Fri", value: 5 },
  { key: "SAT", label: "Sat", value: 6 },
  { key: "SUN", label: "Sun", value: 0 },
];

const MONTHS: Array<{ value: number; label: string }> = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateOnly(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseHolidayNotesToIsoDates(params: {
  text: string;
  year: number;
  month: number;
}): string[] {
  const { text, year, month } = params;

  const monthNameToNumber: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const out: string[] = [];
  const lines = String(text ?? "")
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Accept ISO YYYY-MM-DD
    const iso = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(line);
    if (iso) {
      out.push(line);
      continue;
    }

    // Accept just a day number (e.g. "5") or "Holiday: 5"
    const dayOnly = /(^|\b)([0-9]{1,2})(\b|$)/.exec(line);

    // Accept "5 September" or "September 5" (English)
    const monthWord =
      /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i.exec(
        line,
      );

    const day = dayOnly ? Number(dayOnly[2]) : NaN;
    if (!Number.isFinite(day) || day < 1 || day > 31) continue;

    const monthFromWord = monthWord
      ? monthNameToNumber[String(monthWord[1]).toLowerCase()]
      : undefined;

    const finalMonth = monthFromWord ?? month;
    out.push(toISODateOnly(year, finalMonth, day));
  }

  return Array.from(new Set(out)).sort();
}

export function AIScheduleGeneratorModal(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMonth: number;
  defaultYear: number;
  groups: IdName[];
  subjects: IdName[];
  teachers: Teacher[];
  classrooms: IdName[];
  onGenerated: () => Promise<void>;
}) {
  const { setPageBusy } = useScheduleBuilder();
  const [month, setMonth] = useState<number>(props.defaultMonth);
  const [year, setYear] = useState<number>(props.defaultYear);

  const [workingDays, setWorkingDays] = useState<Record<WeekdayKey, boolean>>({
    MON: true,
    TUE: true,
    WED: true,
    THU: true,
    FRI: true,
    SAT: false,
    SUN: false,
  });

  const [holidayNotes, setHolidayNotes] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [requirements, setRequirements] = useState<RequirementRow[]>([
    { groupId: "", subjectId: "", teacherId: "", roomId: null, lessons: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);

  const monthLabel = useMemo(
    () => MONTHS.find((m) => m.value === month)?.label ?? "",
    [month],
  );

  function addRequirementRow() {
    setRequirements((prev) => [
      ...prev,
      { groupId: "", subjectId: "", teacherId: "", roomId: null, lessons: "" },
    ]);
  }

  function setRow(idx: number, patch: Partial<RequirementRow>) {
    setRequirements((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  function selectedWorkingDayValues() {
    const values: number[] = [];
    for (const w of WEEKDAYS) {
      if (workingDays[w.key]) values.push(w.value);
    }
    return values;
  }

  async function onGenerate() {
    if (submitting) return;

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      toast.error("Month is required");
      return;
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      toast.error("Year must be 2000..2100");
      return;
    }

    const wd = selectedWorkingDayValues();
    if (!wd.length) {
      toast.error("Select at least one working day");
      return;
    }

    const holidays = parseHolidayNotesToIsoDates({
      text: holidayNotes,
      year,
      month,
    });

    const normalizedReqs = requirements.map((r) => ({
      groupId: r.groupId,
      subjectId: r.subjectId,
      teacherId: r.teacherId,
      roomId: r.roomId,
      lessons: Number(r.lessons),
    }));

    for (const [i, r] of normalizedReqs.entries()) {
      if (!r.groupId || !r.subjectId || !r.teacherId) {
        toast.error(
          `Requirement #${i + 1}: group, subject, teacher are required`,
        );
        return;
      }
      if (!Number.isFinite(r.lessons) || r.lessons < 1 || r.lessons > 2000) {
        toast.error(`Requirement #${i + 1}: lessons must be a positive number`);
        return;
      }
    }

    setPageBusy({ label: "Generating with AI…" });
    setSubmitting(true);
    try {
      const res = await aiScheduleApi.generate({
        month,
        year,
        workingDays: wd,
        holidays,
        requirements: normalizedReqs,
        notes: notes.trim() ? notes.trim() : undefined,
      } as any);

      const created = res.data?.data?.created;
      toast.success(
        typeof created === "number"
          ? `Schedule generated (${created} lessons)`
          : "Schedule generated",
      );

      props.onOpenChange(false);
      await props.onGenerated();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Failed to generate schedule",
      );
    } finally {
      setSubmitting(false);
      setPageBusy(null);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>AI Schedule Generator</DialogTitle>
          <DialogDescription>
            Define month settings and requirements, then generate the schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-sm font-semibold">Month Settings</div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={String(year)}
                  onChange={(e) => setYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                />
              </div>

              <div className="space-y-2">
                <Label>Working days</Label>
                <div className="flex flex-wrap gap-3 rounded-md border p-3">
                  {WEEKDAYS.map((w) => (
                    <label
                      key={w.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={workingDays[w.key]}
                        onCheckedChange={(checked) =>
                          setWorkingDays((prev) => ({
                            ...prev,
                            [w.key]: Boolean(checked),
                          }))
                        }
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Holiday notes (optional)</Label>
              <Textarea
                value={holidayNotes}
                onChange={(e) => setHolidayNotes(e.target.value)}
                placeholder={`Holiday: 5 ${monthLabel}\nHoliday: 17 ${monthLabel}`}
                className="min-h-20"
              />
              <div className="text-xs text-muted-foreground">
                One per line. Accepts “YYYY-MM-DD”, “5”, or “5 September”.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Scheduling Requirements
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addRequirementRow}
              >
                + Add Requirement
              </Button>
            </div>

            <div className="space-y-3">
              {requirements.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-5"
                >
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <Select
                      value={row.groupId}
                      onValueChange={(v) => setRow(idx, { groupId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.groups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select
                      value={row.subjectId}
                      onValueChange={(v) => setRow(idx, { subjectId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Teacher</Label>
                    <Select
                      value={row.teacherId}
                      onValueChange={(v) => setRow(idx, { teacherId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Room</Label>
                    <Select
                      value={row.roomId ?? "__none"}
                      onValueChange={(v) =>
                        setRow(idx, { roomId: v === "__none" ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">No room</SelectItem>
                        {props.classrooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Lessons</Label>
                    <Input
                      type="number"
                      min={1}
                      max={2000}
                      value={row.lessons}
                      onChange={(e) => setRow(idx, { lessons: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold">Notes (Optional)</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mami cannot teach Monday morning"
              className="min-h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onGenerate} disabled={submitting}>
            {submitting ? "Generating…" : "Generate Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
