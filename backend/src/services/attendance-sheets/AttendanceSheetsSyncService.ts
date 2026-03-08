import type { AttendanceStatus, PrismaClient, Weekday } from ".prisma/client";
import { randomUUID } from "crypto";
import { env } from "../../config/env";
import { AttendanceSheetsClient } from "./AttendanceSheetsClient";
import { GradesSheetsSyncService } from "../grades-sheets/GradesSheetsSyncService";
import {
  formatAttendanceCell,
  parseAttendanceCell,
} from "./attendanceStatusMap";

function compileOptionalRegex(source?: string): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function normalizeTitle(value: string): string {
  return value.trim();
}

function parseTabTitle(
  tabTitle: string,
): { groupName: string; subjectName: string } | null {
  const title = normalizeTitle(tabTitle);
  const idx = title.lastIndexOf("_");
  if (idx <= 0 || idx >= title.length - 1) return null;
  const groupName = title.slice(0, idx).trim();
  const subjectName = title.slice(idx + 1).trim();
  if (!groupName || !subjectName) return null;
  return { groupName, subjectName };
}

function weekdayFromDate(d: Date): Weekday {
  const day = d.getDay();
  // JS: 0=Sun..6=Sat, Prisma enum: MON..SUN
  switch (day) {
    case 0:
      return "SUN";
    case 1:
      return "MON";
    case 2:
      return "TUE";
    case 3:
      return "WED";
    case 4:
      return "THU";
    case 5:
      return "FRI";
    case 6:
      return "SAT";
    default:
      return "MON";
  }
}

function parseTimeToParts(
  value: string | null | undefined,
): { hh: number; mm: number } | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function dateAtLocalTime(dateOnly: Date, hh: number, mm: number): Date {
  return new Date(
    dateOnly.getFullYear(),
    dateOnly.getMonth(),
    dateOnly.getDate(),
    hh,
    mm,
    0,
    0,
  );
}

function clampToDayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function clampToDayEndExclusive(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}

function parseHeaderDate(raw: string, format: string): Date | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;

  // ISO-like
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + "T00:00:00");
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // MM/DD or DD/MM
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(v);
  if (!m) {
    const d2 = new Date(v);
    return Number.isFinite(d2.getTime()) ? d2 : null;
  }

  const a = Number(m[1]);
  const b = Number(m[2]);
  const yRaw = m[3];

  const now = new Date();
  const year = yRaw
    ? yRaw.length === 2
      ? 2000 + Number(yRaw)
      : Number(yRaw)
    : now.getFullYear();

  const asFormat = format.trim().toUpperCase() === "DD/MM";
  const month = asFormat ? b : a;
  const day = asFormat ? a : b;

  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (!Number.isFinite(d.getTime())) return null;

  // Heuristic: if no year provided and date is far in future, assume previous year
  if (!yRaw) {
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 180) {
      const dPrev = new Date(year - 1, month - 1, day, 0, 0, 0, 0);
      if (Number.isFinite(dPrev.getTime())) return dPrev;
    }
  }

  return d;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHeaderDate(d: Date, format: string): string {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const f = format.trim().toUpperCase();
  return f === "DD/MM" ? `${dd}/${mm}` : `${mm}/${dd}`;
}

function colIndexToA1(idx0: number): string {
  let n = idx0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function clampToDayStartLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function clampToDayEndExclusiveLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}

function parseDateInput(value: string): Date {
  const v = String(value ?? "").trim();
  if (!v) throw new Error("INVALID_DATE");
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const d = isoDay ? new Date(v + "T00:00:00") : new Date(v);
  if (!Number.isFinite(d.getTime())) throw new Error("INVALID_DATE");
  return d;
}

export type AttendanceSheetsSyncResult = {
  runId: string;
  spreadsheetId: string;
  detectedTabs: string[];
  processedTabs: number;
  spreadsheetRows: number;
  syncedLessons: number;
  syncedRecords: number;
  rosterAdded: number;
  rosterUpdated: number;
};

export class AttendanceSheetsSyncService {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureTabAndDates(opts: {
    groupId: string;
    subjectId: string;
    dates: string[];
    assignmentCount?: number;
  }): Promise<{
    sheetTitle: string;
    createdTab: boolean;
    addedDates: number;
  }> {
    if (!env.attendanceSheetsEnabled) {
      throw new Error("ATTENDANCE_SHEETS_DISABLED");
    }

    const spreadsheetId = env.attendanceSheetsSpreadsheetId;
    if (!spreadsheetId) {
      throw new Error("ATTENDANCE_SHEETS_MISSING_SPREADSHEET_ID");
    }

    const [group, subject] = await Promise.all([
      this.prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: opts.subjectId },
        select: { id: true, name: true },
      }),
    ]);

    if (!group) throw new Error("GROUP_NOT_FOUND");
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const sheetTitle = `${group.name}_${subject.name}`;
    if (!this.isAllowedTab(sheetTitle)) {
      throw new Error("ATTENDANCE_SHEETS_TAB_NOT_ALLOWED");
    }

    const runId = randomUUID();
    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "DB_TO_SHEETS",
      action: "tab_ensure_start",
      sheetTitle,
      groupId: group.id,
      subjectId: subject.id,
      message: "Ensuring Attendance Sheet tab and lesson dates",
      meta: { dates: opts.dates },
    });

    const client = new AttendanceSheetsClient();
    const meta = await client.getSpreadsheetMetadata();

    let createdTab = false;
    if (!meta.sheetTitles.map((t) => normalizeTitle(t)).includes(sheetTitle)) {
      await client.createSheetTab({ title: sheetTitle });
      createdTab = true;
    }

    // Ensure base header A1:C1
    await client.setRowValues({
      sheetName: sheetTitle,
      rowNumber: 1,
      values: ["student_uuid", "student_number", "fullname"],
      startColIndex0: 0,
    });

    const headerValues = await client.getSheetValuesRange(sheetTitle, "A1:ZZ1");
    const headerRow = headerValues[0] ?? [];

    const dateFormat = env.attendanceSheetsDateFormat;

    const existingDateKeys = new Set<string>();
    for (let c = 3; c < headerRow.length; c++) {
      const parsed = parseHeaderDate(headerRow[c] ?? "", dateFormat);
      if (!parsed) continue;
      existingDateKeys.add(
        clampToDayStartLocal(parsed).toISOString().slice(0, 10),
      );
    }

    const desiredDates = Array.from(
      new Set(
        (opts.dates ?? [])
          .map((d) =>
            clampToDayStartLocal(parseDateInput(d)).toISOString().slice(0, 10),
          )
          .filter(Boolean),
      ),
    )
      .map((iso) => new Date(iso + "T00:00:00"))
      .filter((d) => Number.isFinite(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const updates: Array<{ range: string; value: string }> = [];

    let nextColIndex = Math.max(3, headerRow.length);
    let addedDates = 0;
    for (const d of desiredDates) {
      const key = d.toISOString().slice(0, 10);
      if (existingDateKeys.has(key)) continue;
      const colAlpha = colIndexToA1(nextColIndex);
      updates.push({
        range: `${sheetTitle}!${colAlpha}1`,
        value: formatHeaderDate(d, dateFormat),
      });
      existingDateKeys.add(key);
      nextColIndex++;
      addedDates++;
    }

    if (updates.length) {
      await client.batchUpdateA1Values({ data: updates });
    }

    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "DB_TO_SHEETS",
      action: "tab_ensure_done",
      sheetTitle,
      groupId: group.id,
      subjectId: subject.id,
      message: "Attendance Sheet tab ensured",
      meta: { createdTab, addedDates },
    });

    // --- Grades spreadsheet (Baholash) ---
    // Requirement: on Attendance creation, also create the Grades tab with HW columns.
    if (opts.assignmentCount !== undefined && opts.assignmentCount !== null) {
      const gradesSvc = new GradesSheetsSyncService(this.prisma);
      await gradesSvc.ensureTabAndHwColumns({
        sheetTitle,
        groupTabTitle: group.name,
        assignmentCount: Number(opts.assignmentCount),
      });
    }

    return { sheetTitle, createdTab, addedDates };
  }

  private async log(opts: {
    spreadsheetId: string;
    runId: string;
    level: "INFO" | "WARN" | "ERROR";
    direction: "SHEETS_TO_DB" | "DB_TO_SHEETS" | "WORKER";
    action: string;
    message: string;
    sheetTitle?: string | null;
    groupId?: string | null;
    subjectId?: string | null;
    lessonId?: string | null;
    studentId?: string | null;
    meta?: any;
  }) {
    await this.prisma.attendanceSheetsSyncLog.create({
      data: {
        spreadsheetId: opts.spreadsheetId,
        runId: opts.runId,
        level: opts.level,
        direction: opts.direction,
        action: opts.action,
        sheetTitle: opts.sheetTitle ?? null,
        groupId: opts.groupId ?? null,
        subjectId: opts.subjectId ?? null,
        lessonId: opts.lessonId ?? null,
        studentId: opts.studentId ?? null,
        message: opts.message,
        meta: opts.meta ?? undefined,
      },
      select: { id: true },
    });
  }

  private isAllowedTab(title: string): boolean {
    const t = normalizeTitle(title);
    if (!t) return false;
    const allow = compileOptionalRegex(env.attendanceSheetsTabsAllowRegex);
    const deny = compileOptionalRegex(env.attendanceSheetsTabsDenyRegex);
    if (allow && !allow.test(t)) return false;
    if (deny && deny.test(t)) return false;
    // Basic rule: must look like GROUP_SUBJECT
    return t.includes("_");
  }

  private async getOrCreateLesson(opts: {
    groupId: string;
    subjectId: string;
    date: Date;
    sheetTitle: string;
    spreadsheetId: string;
    runId: string;
  }): Promise<{ id: string } | null> {
    const dayStart = clampToDayStart(opts.date);
    const dayEnd = clampToDayEndExclusive(opts.date);

    const existing = await this.prisma.lesson.findFirst({
      where: {
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true, startsAt: true, teacherId: true },
      orderBy: { startsAt: "asc" },
    });
    if (existing) return { id: existing.id };

    const weekday = weekdayFromDate(opts.date);

    const scheduleEntries = await this.prisma.scheduleEntry.findMany({
      where: {
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        weekday,
      },
      include: { timeSlot: true, room: true },
      orderBy: { timeSlot: { order: "asc" } },
      take: 3,
    });

    const picked = scheduleEntries[0] ?? null;

    let teacherId: string | null = picked?.teacherId ?? null;
    let startParts = parseTimeToParts(picked?.timeSlot?.startTime ?? null);
    let endParts = parseTimeToParts(picked?.timeSlot?.endTime ?? null);

    if (!teacherId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: opts.subjectId },
        select: { teachers: { select: { id: true }, take: 1 } },
      });
      teacherId = subject?.teachers?.[0]?.id ?? null;
    }

    if (!teacherId) {
      await this.log({
        spreadsheetId: opts.spreadsheetId,
        runId: opts.runId,
        level: "ERROR",
        direction: "SHEETS_TO_DB",
        action: "lesson_create_skipped",
        sheetTitle: opts.sheetTitle,
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        message: "Cannot create lesson: missing teacher mapping",
        meta: { date: opts.date.toISOString() },
      });
      return null;
    }

    if (!startParts) startParts = { hh: 9, mm: 0 };
    if (!endParts) endParts = { hh: 10, mm: 0 };

    const startsAt = dateAtLocalTime(opts.date, startParts.hh, startParts.mm);
    const endsAt = dateAtLocalTime(opts.date, endParts.hh, endParts.mm);

    if (scheduleEntries.length > 1) {
      await this.log({
        spreadsheetId: opts.spreadsheetId,
        runId: opts.runId,
        level: "WARN",
        direction: "SHEETS_TO_DB",
        action: "schedule_ambiguous",
        sheetTitle: opts.sheetTitle,
        groupId: opts.groupId,
        subjectId: opts.subjectId,
        message:
          "Multiple schedule entries found for this group+subject+weekday; picking earliest timeslot",
        meta: {
          weekday,
          candidates: scheduleEntries.map((e) => ({
            teacherId: e.teacherId,
            timeSlot: {
              order: e.timeSlot.order,
              startTime: e.timeSlot.startTime,
              endTime: e.timeSlot.endTime,
            },
          })),
        },
      });
    }

    const created = await this.prisma.lesson.create({
      data: {
        startsAt,
        endsAt,
        room: picked?.room?.name ?? null,
        groupId: opts.groupId,
        teacherId,
        subjectId: opts.subjectId,
      },
      select: { id: true },
    });

    return created;
  }

  private async upsertAttendance(opts: {
    lessonId: string;
    studentId: string;
    status: AttendanceStatus;
  }) {
    await this.prisma.attendance.upsert({
      where: {
        lessonId_studentId: {
          lessonId: opts.lessonId,
          studentId: opts.studentId,
        },
      },
      create: {
        lessonId: opts.lessonId,
        studentId: opts.studentId,
        status: opts.status,
      },
      update: {
        status: opts.status,
        notedAt: new Date(),
      },
      select: { id: true },
    });
  }

  private async deleteAttendanceIfExists(opts: {
    lessonId: string;
    studentId: string;
  }) {
    try {
      await this.prisma.attendance.delete({
        where: {
          lessonId_studentId: {
            lessonId: opts.lessonId,
            studentId: opts.studentId,
          },
        },
        select: { id: true },
      });
    } catch {
      // ignore not found
    }
  }

  async syncOnce(opts?: {
    reason?: string;
  }): Promise<AttendanceSheetsSyncResult> {
    if (!env.attendanceSheetsEnabled) {
      throw new Error("ATTENDANCE_SHEETS_DISABLED");
    }

    const spreadsheetId = env.attendanceSheetsSpreadsheetId;
    if (!spreadsheetId) {
      throw new Error("ATTENDANCE_SHEETS_MISSING_SPREADSHEET_ID");
    }

    const runId = randomUUID();
    const startedAt = new Date();

    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "WORKER",
      action: "sync_start",
      message: "Attendance Sheets sync started",
      meta: { reason: opts?.reason ?? "manual" },
    });

    const client = new AttendanceSheetsClient();
    const meta = await client.getSpreadsheetMetadata();

    const detectedTabs = meta.sheetTitles
      .map((t) => normalizeTitle(t))
      .filter(Boolean)
      .filter((t) => this.isAllowedTab(t));

    let processedTabs = 0;
    let spreadsheetRows = 0;
    let syncedLessons = 0;
    let syncedRecords = 0;
    let rosterAdded = 0;
    let rosterUpdated = 0;

    const dateFormat = env.attendanceSheetsDateFormat;

    const touchedLessonIds = new Set<string>();

    for (const sheetTitle of detectedTabs) {
      const parsed = parseTabTitle(sheetTitle);
      if (!parsed) {
        await this.log({
          spreadsheetId,
          runId,
          level: "WARN",
          direction: "WORKER",
          action: "tab_skipped",
          sheetTitle,
          message: "Tab skipped (not GROUP_SUBJECT)",
        });
        continue;
      }

      const group = await this.prisma.group.findUnique({
        where: { name: parsed.groupName },
        select: { id: true, name: true },
      });
      const subject = await this.prisma.subject.findUnique({
        where: { name: parsed.subjectName },
        select: { id: true, name: true },
      });

      if (!group || !subject) {
        await this.log({
          spreadsheetId,
          runId,
          level: "WARN",
          direction: "WORKER",
          action: "tab_unmapped",
          sheetTitle,
          message: "Tab skipped (group or subject not found in DB)",
          meta: {
            groupName: parsed.groupName,
            subjectName: parsed.subjectName,
            groupFound: Boolean(group),
            subjectFound: Boolean(subject),
          },
        });
        continue;
      }

      // Read enough columns for a month+; extend as needed.
      const values = await client.getSheetValuesRange(sheetTitle, "A1:ZZ");
      if (values.length === 0) {
        // Ensure header exists
        await client.setRowValues({
          sheetName: sheetTitle,
          rowNumber: 1,
          values: ["student_uuid", "student_number", "fullname"],
          startColIndex0: 0,
        });
        processedTabs++;
        continue;
      }

      // Ensure A1:C1 header
      await client.setRowValues({
        sheetName: sheetTitle,
        rowNumber: 1,
        values: ["student_uuid", "student_number", "fullname"],
        startColIndex0: 0,
      });

      const headerRow = values[0] ?? [];
      const dateCols: Array<{ colIndex: number; date: Date }> = [];
      for (let c = 3; c < headerRow.length; c++) {
        const d = parseHeaderDate(headerRow[c] ?? "", dateFormat);
        if (d) dateCols.push({ colIndex: c, date: d });
      }

      const lessonIdByDateKey = new Map<string, string>();

      // Build UUID->studentId map for the group
      const groupStudents = await this.prisma.student.findMany({
        where: { groupId: group.id },
        select: { id: true, fullName: true, studentNumber: true },
        orderBy: [{ studentNumber: "asc" }, { fullName: "asc" }],
      });
      const studentIdByUuid = new Map<string, string>();
      const studentByNumber = new Map<string, { id: string }>();

      // student.id is UUID, so it matches sheet's student_uuid
      for (const s of groupStudents) {
        studentIdByUuid.set(s.id, s.id);
        if (s.studentNumber) studentByNumber.set(s.studentNumber, { id: s.id });
      }

      // Parse existing sheet roster
      const rosterRowByStudentUuid = new Map<string, number>();
      for (let r = 1; r < values.length; r++) {
        const row = values[r] ?? [];
        const uuid = String(row[0] ?? "").trim();
        if (uuid) rosterRowByStudentUuid.set(uuid, r + 1);
      }

      // SHEETS -> DB attendance records
      for (let r = 1; r < values.length; r++) {
        const row = values[r] ?? [];
        const studentUuid = String(row[0] ?? "").trim();
        const studentNumber = String(row[1] ?? "").trim();

        if (!studentUuid && !studentNumber) continue;

        const studentId = studentUuid
          ? (studentIdByUuid.get(studentUuid) ?? null)
          : studentNumber
            ? (studentByNumber.get(studentNumber)?.id ?? null)
            : null;

        if (!studentId) {
          await this.log({
            spreadsheetId,
            runId,
            level: "WARN",
            direction: "SHEETS_TO_DB",
            action: "row_skipped",
            sheetTitle,
            groupId: group.id,
            subjectId: subject.id,
            message: "Row skipped (student not found in group)",
            meta: {
              rowNumber: r + 1,
              student_uuid: studentUuid,
              student_number: studentNumber,
            },
          });
          continue;
        }

        spreadsheetRows++;

        for (const dc of dateCols) {
          const cellRaw = String(row[dc.colIndex] ?? "");
          const parsedStatus = parseAttendanceCell(cellRaw);

          const dateKey = dc.date.toISOString().slice(0, 10);
          let lessonId = lessonIdByDateKey.get(dateKey) ?? null;
          if (!lessonId) {
            const lesson = await this.getOrCreateLesson({
              groupId: group.id,
              subjectId: subject.id,
              date: dc.date,
              sheetTitle,
              spreadsheetId,
              runId,
            });
            if (!lesson) continue;
            lessonId = lesson.id;
            lessonIdByDateKey.set(dateKey, lessonId);
          }

          touchedLessonIds.add(lessonId);

          if (parsedStatus) {
            await this.upsertAttendance({
              lessonId,
              studentId,
              status: parsedStatus,
            });
            syncedRecords++;
          } else {
            // Clearing a cell deletes the record (two-way intent)
            if (cellRaw.trim() === "") {
              await this.deleteAttendanceIfExists({ lessonId, studentId });
            }
          }
        }
      }

      // Roster DB -> SHEETS (A-C only)
      if (env.attendanceSheetsDbToSheetsEnabled) {
        // Update existing rows and append missing students
        for (const s of groupStudents) {
          const rowNumber = rosterRowByStudentUuid.get(s.id) ?? null;
          const payload = [s.id, s.studentNumber ?? "", s.fullName];

          if (rowNumber) {
            await client.setRowValues({
              sheetName: sheetTitle,
              rowNumber,
              values: payload,
              startColIndex0: 0,
            });
            rosterUpdated++;
          } else {
            await client.appendRow({
              sheetName: sheetTitle,
              values: payload,
            });
            rosterAdded++;
          }
        }
      }

      processedTabs++;
    }

    syncedLessons = touchedLessonIds.size;

    const finishedAt = new Date();

    await this.prisma.attendanceSheetsSyncState.upsert({
      where: { spreadsheetId },
      update: {
        lastRunId: runId,
        lastStatus: "SUCCESS",
        lastSyncAt: finishedAt,
        lastSuccessAt: finishedAt,
        lastError: null,
        detectedTabs,
        processedTabs,
        spreadsheetRows,
        syncedLessons,
        syncedRecords,
        rosterAdded,
        rosterUpdated,
      },
      create: {
        spreadsheetId,
        lastRunId: runId,
        lastStatus: "SUCCESS",
        lastSyncAt: finishedAt,
        lastSuccessAt: finishedAt,
        lastError: null,
        detectedTabs,
        processedTabs,
        spreadsheetRows,
        syncedLessons,
        syncedRecords,
        rosterAdded,
        rosterUpdated,
      },
      select: { id: true },
    });

    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "WORKER",
      action: "sync_done",
      message: "Attendance Sheets sync completed",
      meta: {
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        processedTabs,
        spreadsheetRows,
        syncedRecords,
        rosterAdded,
        rosterUpdated,
      },
    });

    return {
      runId,
      spreadsheetId,
      detectedTabs,
      processedTabs,
      spreadsheetRows,
      syncedLessons,
      syncedRecords,
      rosterAdded,
      rosterUpdated,
    };
  }

  /**
   * Pushes DB attendance for a single (groupId, subjectId, date) into the corresponding
   * Attendance Sheet tab (GROUPNAME_SUBJECTNAME). This is used by the admin UI save flow.
   */
  async pushAttendanceByDateToSheet(opts: {
    groupId: string;
    subjectId: string;
    date: string;
  }): Promise<{ sheetTitle: string; updatedCells: number }> {
    if (!env.attendanceSheetsEnabled) {
      throw new Error("ATTENDANCE_SHEETS_DISABLED");
    }

    const spreadsheetId = env.attendanceSheetsSpreadsheetId;
    if (!spreadsheetId) {
      throw new Error("ATTENDANCE_SHEETS_MISSING_SPREADSHEET_ID");
    }

    if (!env.attendanceSheetsDbToSheetsEnabled) {
      // Keep behavior explicit; controller can decide to ignore this error.
      throw new Error("ATTENDANCE_SHEETS_DB_TO_SHEETS_DISABLED");
    }

    const runId = randomUUID();
    const date = parseDateInput(opts.date);
    const dayStart = clampToDayStartLocal(date);
    const dayEnd = clampToDayEndExclusiveLocal(date);

    const [group, subject] = await Promise.all([
      this.prisma.group.findUnique({
        where: { id: opts.groupId },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findUnique({
        where: { id: opts.subjectId },
        select: { id: true, name: true },
      }),
    ]);

    if (!group) throw new Error("GROUP_NOT_FOUND");
    if (!subject) throw new Error("SUBJECT_NOT_FOUND");

    const sheetTitle = `${group.name}_${subject.name}`;
    if (!this.isAllowedTab(sheetTitle)) {
      throw new Error("ATTENDANCE_SHEETS_TAB_NOT_ALLOWED");
    }

    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "DB_TO_SHEETS",
      action: "push_by_date_start",
      sheetTitle,
      groupId: group.id,
      subjectId: subject.id,
      message: "DB -> Sheets attendance push started",
      meta: { date: dayStart.toISOString().slice(0, 10) },
    });

    const client = new AttendanceSheetsClient();
    const meta = await client.getSpreadsheetMetadata();

    if (!meta.sheetTitles.includes(sheetTitle)) {
      await client.createSheetTab({ title: sheetTitle });
      // Ensure base header A1:C1
      await client.setRowValues({
        sheetName: sheetTitle,
        rowNumber: 1,
        values: ["student_uuid", "student_number", "fullname"],
        startColIndex0: 0,
      });
    }

    // Ensure A1:C1 header always exists
    await client.setRowValues({
      sheetName: sheetTitle,
      rowNumber: 1,
      values: ["student_uuid", "student_number", "fullname"],
      startColIndex0: 0,
    });

    const headerValues = await client.getSheetValuesRange(sheetTitle, "A1:ZZ1");
    const headerRow = headerValues[0] ?? [];

    const dateFormat = env.attendanceSheetsDateFormat;
    const normalizedTargetKey = dayStart.toISOString().slice(0, 10);

    let dateColIndex = -1;
    for (let c = 3; c < headerRow.length; c++) {
      const parsed = parseHeaderDate(headerRow[c] ?? "", dateFormat);
      if (!parsed) continue;
      const key = clampToDayStartLocal(parsed).toISOString().slice(0, 10);
      if (key === normalizedTargetKey) {
        dateColIndex = c;
        break;
      }
    }

    if (dateColIndex === -1) {
      dateColIndex = Math.max(3, headerRow.length);
      const colAlpha = colIndexToA1(dateColIndex);
      const headerCellRange = `${sheetTitle}!${colAlpha}1`;
      await client.batchUpdateA1Values({
        data: [
          {
            range: headerCellRange,
            value: formatHeaderDate(dayStart, dateFormat),
          },
        ],
      });
    }

    // Load group roster from DB
    const groupStudents = await this.prisma.student.findMany({
      where: { groupId: group.id },
      select: { id: true, fullName: true, studentNumber: true },
      orderBy: [{ studentNumber: "asc" }, { fullName: "asc" }],
      take: 5000,
    });

    // Map existing sheet roster UUID -> rowNumber
    const rosterValues = await client.getSheetValuesRange(sheetTitle, "A1:C");
    const rosterRowByUuid = new Map<string, number>();
    for (let r = 1; r < rosterValues.length; r++) {
      const uuid = String(rosterValues[r]?.[0] ?? "").trim();
      if (uuid) rosterRowByUuid.set(uuid, r + 1);
    }

    // Ensure every DB student has a roster row
    for (const s of groupStudents) {
      if (rosterRowByUuid.has(s.id)) continue;
      const rowNumber = await client.appendRow({
        sheetName: sheetTitle,
        values: [s.id, s.studentNumber ?? "", s.fullName],
      });
      if (rowNumber) rosterRowByUuid.set(s.id, rowNumber);
    }

    // Find lesson for that day and get attendance map
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        groupId: group.id,
        subjectId: subject.id,
        startsAt: { gte: dayStart, lt: dayEnd },
      },
      select: { id: true },
      orderBy: { startsAt: "asc" },
    });

    const statusByStudentId = new Map<string, AttendanceStatus>();
    if (lesson?.id) {
      const rows = await this.prisma.attendance.findMany({
        where: { lessonId: lesson.id },
        select: { studentId: true, status: true },
        take: 5000,
      });
      for (const r of rows) statusByStudentId.set(r.studentId, r.status);
    }

    const colAlpha = colIndexToA1(dateColIndex);
    const updates: Array<{ range: string; value: string }> = [];
    for (const s of groupStudents) {
      const rowNumber = rosterRowByUuid.get(s.id);
      if (!rowNumber) continue;
      const cellRange = `${sheetTitle}!${colAlpha}${rowNumber}`;
      const v = formatAttendanceCell(statusByStudentId.get(s.id) ?? null);
      updates.push({ range: cellRange, value: v });
    }

    // Batch-update in chunks to stay well under API limits
    let updatedCells = 0;
    const chunkSize = 400;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await client.batchUpdateA1Values({ data: chunk });
      updatedCells += chunk.length;
    }

    await this.log({
      spreadsheetId,
      runId,
      level: "INFO",
      direction: "DB_TO_SHEETS",
      action: "push_by_date_done",
      sheetTitle,
      groupId: group.id,
      subjectId: subject.id,
      message: "DB -> Sheets attendance push completed",
      meta: {
        date: dayStart.toISOString().slice(0, 10),
        updatedCells,
        lessonFound: Boolean(lesson?.id),
      },
    });

    return { sheetTitle, updatedCells };
  }

  async recordFailure(error: unknown) {
    const spreadsheetId = env.attendanceSheetsSpreadsheetId ?? "unknown";

    const lastSyncAt = new Date();
    const message =
      typeof (error as any)?.message === "string"
        ? (error as any).message
        : String(error);

    await this.prisma.attendanceSheetsSyncState.upsert({
      where: { spreadsheetId },
      update: {
        lastStatus: "FAILED",
        lastSyncAt,
        lastError: message,
      },
      create: {
        spreadsheetId,
        lastStatus: "FAILED",
        lastSyncAt,
        lastError: message,
      },
      select: { id: true },
    });
  }

  async listTabs(): Promise<
    Array<{
      sheetTitle: string;
      groupName: string;
      subjectName: string;
      groupId: string | null;
      subjectId: string | null;
    }>
  > {
    if (!env.attendanceSheetsEnabled) {
      throw new Error("ATTENDANCE_SHEETS_DISABLED");
    }

    const client = new AttendanceSheetsClient();
    const meta = await client.getSpreadsheetMetadata();
    const tabs = meta.sheetTitles
      .map((t) => normalizeTitle(t))
      .filter(Boolean)
      .filter((t) => this.isAllowedTab(t));

    const result: Array<{
      sheetTitle: string;
      groupName: string;
      subjectName: string;
      groupId: string | null;
      subjectId: string | null;
    }> = [];

    for (const t of tabs) {
      const parsed = parseTabTitle(t);
      if (!parsed) continue;

      const [group, subject] = await Promise.all([
        this.prisma.group.findUnique({
          where: { name: parsed.groupName },
          select: { id: true },
        }),
        this.prisma.subject.findUnique({
          where: { name: parsed.subjectName },
          select: { id: true },
        }),
      ]);

      result.push({
        sheetTitle: t,
        groupName: parsed.groupName,
        subjectName: parsed.subjectName,
        groupId: group?.id ?? null,
        subjectId: subject?.id ?? null,
      });
    }

    return result;
  }

  async previewTab(opts: { sheetTitle: string; takeRows?: number }) {
    const sheetTitle = normalizeTitle(opts.sheetTitle);
    if (!sheetTitle) throw new Error("TAB_REQUIRED");

    const client = new AttendanceSheetsClient();
    const values = await client.getSheetValuesRange(sheetTitle, "A1:ZZ");

    const take = Math.min(Math.max(opts.takeRows ?? 25, 1), 200);
    const sliced = values.slice(0, take);

    return {
      sheetTitle,
      rows: sliced,
    };
  }
}
