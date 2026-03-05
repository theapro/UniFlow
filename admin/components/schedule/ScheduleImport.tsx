"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";
import { ImportDialog } from "@/components/shared/ImportDialog";
import { toast } from "sonner";
import { groupsApi, lessonsApi, subjectsApi, teachersApi } from "@/lib/api";

type ParsedLessonRow = {
  groupName: string;
  subjectName: string;
  teacherName: string;
  room?: string | null;
  startsAt: string;
  endsAt: string;
};

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseYearMonthFromFileName(fileName: string): {
  year: number;
  month: number;
} {
  const jp = fileName.match(/(\d{4})年(\d{1,2})月/);
  if (jp) {
    return { year: Number(jp[1]), month: Number(jp[2]) };
  }

  const dot = fileName.match(/(\d{4})\.(\d{1,2})/);
  if (dot) {
    return { year: Number(dot[1]), month: Number(dot[2]) };
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function toMonthValue(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

function parseTimeRange(input: unknown): { start: string; end: string } | null {
  const text = String(input ?? "")
    .replace(/\u3000/g, " ")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const m = text.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (!m) return null;
  return { start: m[1], end: m[2] };
}

function parseTimetableCell(value: unknown): {
  subjectName: string;
  room: string | null;
  teacherName: string;
} | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Most usable format in this file: Subject \n Room \n Teacher
  if (lines.length >= 3) {
    return {
      subjectName: lines[0],
      room: lines[1] || null,
      teacherName: lines[2],
    };
  }

  // Sometimes room can be missing: Subject \n Teacher
  if (lines.length === 2) {
    return {
      subjectName: lines[0],
      room: null,
      teacherName: lines[1],
    };
  }

  return null;
}

export function ScheduleImport({ lang, dict }: { lang: string; dict: any }) {
  const [importOpen, setImportOpen] = useState(false);
  const [lastParseStats, setLastParseStats] = useState<{
    parsed: number;
    skipped: number;
    year: number;
    month: number;
  } | null>(null);

  const ui = useMemo(
    () => ({
      title: dict?.schedule?.title ?? "Schedule",
      import: "Import timetable",
      importTitle: "Import timetable (CSV/XLSX)",
      importDescription:
        "Uploads an Excel/CSV timetable and creates Lesson records for cells that contain Subject / Room / Teacher.",
    }),
    [dict],
  );

  const parseFile = async (file: File): Promise<ParsedLessonRow[]> => {
    const { year, month } = parseYearMonthFromFileName(file.name);

    // Hint the preview to open the same month as the imported file
    if (typeof window !== "undefined") {
      const monthValue = toMonthValue(year, month);
      window.localStorage.setItem("schedule:lastImportedMonth", monthValue);
      window.dispatchEvent(
        new CustomEvent("schedule:lastImportedMonth", { detail: monthValue }),
      );
    }

    const rows = await new Promise<any[][]>((resolve, reject) => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: false,
        complete: (results) => resolve(results.data as any[][]),
        error: (error) => reject(error),
      });
    });

    if (!rows.length) {
      setLastParseStats({ parsed: 0, skipped: 0, year, month });
      return [];
    }

    const headerRow = rows[0] ?? [];
    const groupColumns: Array<{ colIndex: number; groupName: string }> = [];

    // In this file: first 4 columns are metadata (date, weekday, period, time)
    for (let colIndex = 4; colIndex < headerRow.length; colIndex++) {
      const groupName = String(headerRow[colIndex] ?? "").trim();
      if (!groupName) continue;
      groupColumns.push({ colIndex, groupName });
    }

    let parsed = 0;
    let skipped = 0;
    const output: ParsedLessonRow[] = [];

    // Some timetable exports only show the day number once per day block,
    // leaving subsequent period rows with an empty day cell. Carry it forward.
    let currentDay: number | null = null;

    for (const row of rows) {
      const dayText = String(row?.[0] ?? "").trim();
      let day: number | null = null;

      if (dayText) {
        const parsedDay = Number.parseInt(dayText, 10);
        if (Number.isFinite(parsedDay)) {
          currentDay = parsedDay;
          day = parsedDay;
        } else {
          // Non-numeric day markers (e.g. separators) are ignored
          continue;
        }
      } else if (currentDay != null) {
        day = currentDay;
      } else {
        continue;
      }

      const timeRange = parseTimeRange(row?.[3]);
      if (!timeRange) continue;

      const [startH, startM] = timeRange.start.split(":").map(Number);
      const [endH, endM] = timeRange.end.split(":").map(Number);
      if (
        !Number.isFinite(startH) ||
        !Number.isFinite(startM) ||
        !Number.isFinite(endH) ||
        !Number.isFinite(endM)
      ) {
        continue;
      }

      const startsAt = new Date(year, month - 1, day, startH, startM, 0, 0);
      const endsAt = new Date(year, month - 1, day, endH, endM, 0, 0);

      for (const { colIndex, groupName } of groupColumns) {
        const cell = row?.[colIndex];
        const parsedCell = parseTimetableCell(cell);
        if (!parsedCell) {
          if (String(cell ?? "").trim()) skipped++;
          continue;
        }

        output.push({
          groupName,
          subjectName: parsedCell.subjectName,
          teacherName: parsedCell.teacherName,
          room: parsedCell.room,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        });
        parsed++;
      }
    }

    setLastParseStats({ parsed, skipped, year, month });
    return output;
  };

  const handleImport = async (rows: ParsedLessonRow[]) => {
    if (!rows.length) {
      toast.error("No lessons found to import from this file.");
      return;
    }

    const uniqueGroups = Array.from(
      new Set(rows.map((r) => r.groupName).filter(Boolean)),
    );
    const uniqueSubjects = Array.from(
      new Set(rows.map((r) => r.subjectName).filter(Boolean)),
    );
    const uniqueTeachers = Array.from(
      new Set(rows.map((r) => r.teacherName).filter(Boolean)),
    );

    await toast.promise(
      (async () => {
        const [groupsRes, subjectsRes, teachersRes] = await Promise.all([
          groupsApi.list({ take: 1000 }),
          subjectsApi.list({ take: 1000 }),
          teachersApi.list({ take: 1000 }),
        ]);

        const groups = groupsRes.data.data as any[];
        const subjects = subjectsRes.data.data as any[];
        const teachers = teachersRes.data.data as any[];

        const groupMap = new Map<string, string>(
          groups.map((g) => [normalizeName(g.name), g.id]),
        );
        const subjectMap = new Map<string, string>(
          subjects.map((s) => [normalizeName(s.name), s.id]),
        );
        const teacherMap = new Map<string, string>(
          teachers.map((t) => [normalizeName(t.fullName), t.id]),
        );

        const ensureGroup = async (name: string) => {
          const key = normalizeName(name);
          const existing = groupMap.get(key);
          if (existing) return existing;
          const created = await groupsApi.create({ name });
          const id = created.data.data.id;
          groupMap.set(key, id);
          return id;
        };

        const ensureSubject = async (name: string) => {
          const key = normalizeName(name);
          const existing = subjectMap.get(key);
          if (existing) return existing;
          const created = await subjectsApi.create({ name });
          const id = created.data.data.id;
          subjectMap.set(key, id);
          return id;
        };

        const ensureTeacher = async (fullName: string) => {
          const key = normalizeName(fullName);
          const existing = teacherMap.get(key);
          if (existing) return existing;
          const created = await teachersApi.create({ fullName });
          const id = created.data.data.id;
          teacherMap.set(key, id);
          return id;
        };

        // Pre-create missing entities to reduce race conditions
        await Promise.all(uniqueGroups.map((g) => ensureGroup(g)));
        await Promise.all(uniqueSubjects.map((s) => ensureSubject(s)));
        await Promise.all(uniqueTeachers.map((t) => ensureTeacher(t)));

        const results = await Promise.allSettled(
          rows.map(async (r) => {
            const groupId = await ensureGroup(r.groupName);
            const subjectId = await ensureSubject(r.subjectName);
            const teacherId = await ensureTeacher(r.teacherName);

            return lessonsApi.create({
              startsAt: r.startsAt,
              endsAt: r.endsAt,
              room: r.room ?? null,
              groupId,
              teacherId,
              subjectId,
            });
          }),
        );

        const okCount = results.filter((x) => x.status === "fulfilled").length;
        const failCount = results.filter((x) => x.status === "rejected").length;

        return { okCount, failCount };
      })(),
      {
        loading: `Importing ${rows.length} lesson(s)...`,
        success: (res) => {
          const stats = lastParseStats;
          const extra = stats
            ? ` Parsed ${stats.parsed}, skipped ${stats.skipped} (missing Subject/Room/Teacher).`
            : "";

          return `Imported ${res.okCount} lesson(s). Failed ${res.failCount}.${extra}`;
        },
        error: "Failed to import timetable.",
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {ui.importDescription}
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          {ui.import}
        </Button>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
        title={ui.importTitle}
        description={ui.importDescription}
        templateColumns={[]}
        parseFile={parseFile}
      />
    </div>
  );
}
