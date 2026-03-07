import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { env } from "../../config/env";
import { TeachersSheetsClient } from "./TeachersSheetsClient";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function indexToColAlpha(idx: number): string {
  let alpha = "";
  while (idx >= 0) {
    alpha = String.fromCharCode((idx % 26) + 65) + alpha;
    idx = Math.floor(idx / 26) - 1;
  }
  return alpha;
}

function normalizeHeaderKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parseMaybeDate(raw: string | undefined | null): Date | null {
  const v = (raw ?? "").trim();
  if (!v) return null;

  if (/^\d{13}$/.test(v)) {
    const asNum = Number(v);
    const d = new Date(asNum);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function compileOptionalRegex(source?: string): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

const TEACHERS_SHEET_HEADER = [
  "teacher_uuid",
  "teacher_number",
  "fullname",
  "email",
  "phone",
  "telegram",
  "note",
  "created_at",
  "updated_at",
];

type AggregatedTeacher = {
  id: string;
  staffNo: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  note: string | null;
  sheetCreatedAt: Date | null;
  sheetUpdatedAt: Date | null;
  subjects: Set<string>;
  sourceTabs: Set<string>;
};

export class TeachersSheetsSyncService {
  constructor(private readonly prisma: PrismaClient) {}

  private isAllowedSubjectTab(title: string): boolean {
    const t = title.trim();
    if (!t) return false;

    const allow = compileOptionalRegex(env.teachersSheetsSubjectTabsAllowRegex);
    const deny = compileOptionalRegex(env.teachersSheetsSubjectTabsDenyRegex);

    if (allow && !allow.test(t)) return false;
    if (deny && deny.test(t)) return false;
    return true;
  }

  private async log(opts: {
    spreadsheetId: string;
    runId: string;
    level: "INFO" | "WARN" | "ERROR";
    action: string;
    message: string;
    sheetTitle?: string | null;
    teacherId?: string | null;
    meta?: any;
  }) {
    await this.prisma.teachersSheetsSyncLog.create({
      data: {
        spreadsheetId: opts.spreadsheetId,
        runId: opts.runId,
        level: opts.level,
        direction: "SHEETS_TO_DB",
        action: opts.action,
        sheetTitle: opts.sheetTitle ?? null,
        teacherId: opts.teacherId ?? null,
        message: opts.message,
        meta: opts.meta ?? undefined,
      },
      select: { id: true },
    });
  }

  async syncOnce(opts?: { reason?: string }) {
    if (!env.teachersSheetsEnabled) {
      throw new Error("TEACHERS_SHEETS_DISABLED");
    }

    const spreadsheetId = env.teachersSheetsSpreadsheetId;
    if (!spreadsheetId) {
      throw new Error("TEACHERS_SHEETS_MISSING_SPREADSHEET_ID");
    }

    const runId = randomUUID();
    const startedAt = new Date();

    try {
      await this.log({
        spreadsheetId,
        runId,
        level: "INFO",
        action: "sync_start",
        message: "Teachers Sheets sync started",
        meta: { reason: opts?.reason ?? "manual" },
      });

      const allow = compileOptionalRegex(
        env.teachersSheetsSubjectTabsAllowRegex,
      );
      const deny = compileOptionalRegex(env.teachersSheetsSubjectTabsDenyRegex);

      const client = new TeachersSheetsClient();
      const meta = await client.getSpreadsheetMetadata();

      const detectedSubjects = meta.sheetTitles
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => (allow ? allow.test(t) : true))
        .filter((t) => (deny ? !deny.test(t) : true));

      const aggregatedById = new Map<string, AggregatedTeacher>();
      const headerMismatches: Array<{ sheetTitle: string; missing: string[] }> =
        [];
      let fieldConflicts = 0;
      const fieldConflictSamples: Array<{
        sheetTitle: string;
        teacherId: string;
        field: string;
        kept: string;
        incoming: string;
      }> = [];
      let spreadsheetRows = 0;
      let rowsSkipped = 0;
      let invalidUuid = 0;

      for (const sheetTitle of detectedSubjects) {
        const values = await client.getSheetValuesRange(sheetTitle, "A1:Z");
        if (values.length === 0) continue;

        const headerRow = values[0] ?? [];
        const keyToIndex: Record<string, number> = {};
        for (let idx = 0; idx < headerRow.length; idx++) {
          const k = normalizeHeaderKey(String(headerRow[idx] ?? ""));
          if (k) keyToIndex[k] = idx;
        }

        const required = ["teacher_uuid", "fullname"];
        const missing = required.filter((k) => keyToIndex[k] === undefined);
        if (missing.length > 0) {
          headerMismatches.push({ sheetTitle, missing });
          await this.log({
            spreadsheetId,
            runId,
            level: "WARN",
            action: "header_mismatch",
            sheetTitle,
            message: `Missing required columns: ${missing.join(", ")}`,
          });
          continue;
        }

        const updatesInSheet: Record<number, Record<string, string>> = {};

        for (let r = 1; r < values.length; r++) {
          const row = values[r] ?? [];
          let teacherUuid = String(row[keyToIndex.teacher_uuid] ?? "").trim();
          const fullName = String(row[keyToIndex.fullname] ?? "").trim();

          if (!teacherUuid && !fullName) continue;

          let needsSheetUpdate = false;
          const colToUpdate: Record<string, string> = {};

          if (!teacherUuid) {
            teacherUuid = randomUUID();
            needsSheetUpdate = true;
            colToUpdate[indexToColAlpha(keyToIndex.teacher_uuid)] = teacherUuid;
          }

          if (!isUuid(teacherUuid)) {
            invalidUuid++;
            rowsSkipped++;
            await this.log({
              spreadsheetId,
              runId,
              level: "WARN",
              action: "row_skipped",
              sheetTitle,
              message: "Row skipped (invalid teacher_uuid)",
              meta: { rowNumber: r + 1, teacher_uuid: teacherUuid },
            });
            continue;
          }

          spreadsheetRows++;

          const teacherNumber =
            keyToIndex.teacher_number !== undefined
              ? String(row[keyToIndex.teacher_number] ?? "").trim()
              : "";
          const email =
            keyToIndex.email !== undefined
              ? String(row[keyToIndex.email] ?? "").trim()
              : "";

          // Auto-fill dates if missing
          const now = new Date();
          const nowStr = now.toISOString();

          if (
            keyToIndex.created_at !== undefined &&
            !String(row[keyToIndex.created_at] ?? "").trim()
          ) {
            needsSheetUpdate = true;
            colToUpdate[indexToColAlpha(keyToIndex.created_at)] = nowStr;
          }
          if (keyToIndex.updated_at !== undefined) {
            needsSheetUpdate = true;
            colToUpdate[indexToColAlpha(keyToIndex.updated_at)] = nowStr;
          }

          if (needsSheetUpdate) {
            await client.batchUpdateCells({
              sheetName: sheetTitle,
              rowNumber: r + 1,
              colToValue: colToUpdate,
            });
          }

          const phone =
            keyToIndex.phone !== undefined
              ? String(row[keyToIndex.phone] ?? "").trim()
              : "";
          const telegram =
            keyToIndex.telegram !== undefined
              ? String(row[keyToIndex.telegram] ?? "").trim()
              : "";
          const note =
            keyToIndex.note !== undefined
              ? String(row[keyToIndex.note] ?? "").trim()
              : "";
          const createdAtRaw =
            keyToIndex.created_at !== undefined
              ? String(row[keyToIndex.created_at] ?? "").trim()
              : "";
          const updatedAtRaw =
            keyToIndex.updated_at !== undefined
              ? String(row[keyToIndex.updated_at] ?? "").trim()
              : "";

          const sheetCreatedAt = parseMaybeDate(createdAtRaw);
          const sheetUpdatedAt = parseMaybeDate(updatedAtRaw);

          const existing = aggregatedById.get(teacherUuid);
          if (!existing) {
            aggregatedById.set(teacherUuid, {
              id: teacherUuid,
              staffNo: teacherNumber || null,
              fullName: fullName || "(Unnamed Teacher)",
              email: email || null,
              phone: phone || null,
              telegram: telegram || null,
              note: note || null,
              sheetCreatedAt,
              sheetUpdatedAt,
              subjects: new Set([sheetTitle]),
              sourceTabs: new Set([sheetTitle]),
            });
            continue;
          }

          existing.subjects.add(sheetTitle);
          existing.sourceTabs.add(sheetTitle);

          const maybeConflict = (
            field: keyof Pick<
              AggregatedTeacher,
              "fullName" | "staffNo" | "email" | "phone" | "telegram" | "note"
            >,
            incoming: string,
          ) => {
            const current = String(existing[field] ?? "").trim();
            const inc = incoming.trim();
            if (!inc) return;
            if (!current) {
              (existing as any)[field] = inc;
              return;
            }
            if (current !== inc) {
              fieldConflicts++;
              if (fieldConflictSamples.length < 20) {
                fieldConflictSamples.push({
                  sheetTitle,
                  teacherId: existing.id,
                  field: String(field),
                  kept: current,
                  incoming: inc,
                });
              }
            }
          };

          maybeConflict("fullName", fullName);
          maybeConflict("staffNo", teacherNumber);
          maybeConflict("email", email);
          maybeConflict("phone", phone);
          maybeConflict("telegram", telegram);
          maybeConflict("note", note);

          if (sheetCreatedAt) {
            if (
              !existing.sheetCreatedAt ||
              sheetCreatedAt < existing.sheetCreatedAt
            )
              existing.sheetCreatedAt = sheetCreatedAt;
          }
          if (sheetUpdatedAt) {
            if (
              !existing.sheetUpdatedAt ||
              sheetUpdatedAt > existing.sheetUpdatedAt
            )
              existing.sheetUpdatedAt = sheetUpdatedAt;
          }
        }
      }

      const subjectNames = Array.from(new Set(detectedSubjects));
      if (subjectNames.length > 0) {
        await this.prisma.subject.createMany({
          data: subjectNames.map((name) => ({ name })),
          skipDuplicates: true,
        });
      }

      const dbSubjects = await this.prisma.subject.findMany({
        where: { name: { in: subjectNames } },
        select: { id: true, name: true },
      });
      const subjectIdByName = new Map(dbSubjects.map((s) => [s.name, s.id]));

      let syncedTeachers = 0;
      let teachersCreated = 0;
      let teachersUpdated = 0;

      await this.prisma.$transaction(async (tx) => {
        for (const teacher of aggregatedById.values()) {
          const subjectIds = Array.from(teacher.subjects)
            .map((name) => subjectIdByName.get(name))
            .filter((id): id is string => typeof id === "string");

          const existed = await tx.teacher.findUnique({
            where: { id: teacher.id },
            select: { id: true },
          });

          await tx.teacher.upsert({
            where: { id: teacher.id },
            create: {
              id: teacher.id,
              fullName: teacher.fullName,
              staffNo: teacher.staffNo,
              email: teacher.email,
              phone: teacher.phone,
              telegram: teacher.telegram,
              note: teacher.note,
              sheetCreatedAt: teacher.sheetCreatedAt,
              sheetUpdatedAt: teacher.sheetUpdatedAt,
              subjects: { connect: subjectIds.map((id) => ({ id })) },
            },
            update: {
              fullName: teacher.fullName,
              staffNo: teacher.staffNo,
              email: teacher.email,
              phone: teacher.phone,
              telegram: teacher.telegram,
              note: teacher.note,
              sheetCreatedAt: teacher.sheetCreatedAt,
              sheetUpdatedAt: teacher.sheetUpdatedAt,
              subjects: { set: subjectIds.map((id) => ({ id })) },
            },
            select: { id: true },
          });

          syncedTeachers++;
          if (existed) teachersUpdated++;
          else teachersCreated++;
        }
      });

      const finishedAt = new Date();

      if (fieldConflicts > 0) {
        await this.log({
          spreadsheetId,
          runId,
          level: "WARN",
          action: "field_conflicts",
          message:
            "Detected conflicting teacher fields across subject tabs; kept first non-empty value",
          meta: { count: fieldConflicts, samples: fieldConflictSamples },
        });
      }

      await this.prisma.teachersSheetsSyncState.upsert({
        where: { spreadsheetId },
        update: {
          lastRunId: runId,
          lastStatus: "SUCCESS",
          lastSyncAt: finishedAt,
          lastSuccessAt: finishedAt,
          lastError: null,
          detectedSubjects,
          syncedTeachers,
          spreadsheetRows,
        },
        create: {
          spreadsheetId,
          lastRunId: runId,
          lastStatus: "SUCCESS",
          lastSyncAt: finishedAt,
          lastSuccessAt: finishedAt,
          lastError: null,
          detectedSubjects,
          syncedTeachers,
          spreadsheetRows,
        },
        select: { id: true },
      });

      await this.log({
        spreadsheetId,
        runId,
        level: "INFO",
        action: "sync_done",
        message: "Teachers Sheets sync completed",
        meta: {
          startedAt,
          finishedAt,
          ms: finishedAt.getTime() - startedAt.getTime(),
          subjects: detectedSubjects.length,
          teachers: syncedTeachers,
          teachersCreated,
          teachersUpdated,
          spreadsheetRows,
          rowsSkipped,
          invalidUuid,
          headerMismatches,
        },
      });

      const result = {
        spreadsheetId: meta.spreadsheetId,
        spreadsheetTitle: meta.title ?? null,
        runId,
        startedAt,
        finishedAt,
        detectedSubjects,
        headerMismatches,
        spreadsheetRows,
        rowsSkipped,
        invalidUuid,
        syncedTeachers,
        teachersCreated,
        teachersUpdated,
      };

      if (env.teachersSheetsDbToSheetsEnabled) {
        try {
          await this.syncDbToSheets();
        } catch (e: any) {
          console.error("[TeachersSheetsSyncService] dbToSheets failed:", e);
        }
      }

      return result;
    } catch (e: any) {
      console.error(
        "[TeachersSheetsSyncService] Critical error during sync:",
        e,
      );
      await this.log({
        spreadsheetId: spreadsheetId ?? "unknown",
        runId,
        level: "ERROR",
        action: "sync_failed",
        message:
          typeof e?.message === "string"
            ? e.message
            : "Sync failed unexpectedly",
        meta: { stack: e?.stack },
      });
      throw e;
    }
  }

  async renameSubjectTab(opts: { fromTitle: string; toTitle: string }) {
    if (!env.teachersSheetsEnabled) return;
    if (!env.teachersSheetsSpreadsheetId) return;
    if (!this.isAllowedSubjectTab(opts.toTitle)) return;

    const client = new TeachersSheetsClient();
    const meta = await client.getSpreadsheetMetadata();
    if (!meta.sheetTitles.includes(opts.fromTitle)) return;
    if (meta.sheetTitles.includes(opts.toTitle)) return;

    await client.renameSheetTab({
      fromTitle: opts.fromTitle,
      toTitle: opts.toTitle,
    });

    // Ensure header exists after rename
    await client.setRowValues({
      sheetName: opts.toTitle,
      rowNumber: 1,
      values: TEACHERS_SHEET_HEADER,
    });
  }

  async syncDbToSheets() {
    if (!env.teachersSheetsEnabled || !env.teachersSheetsDbToSheetsEnabled) {
      return;
    }

    const spreadsheetId = env.teachersSheetsSpreadsheetId;
    if (!spreadsheetId) return;

    const client = new TeachersSheetsClient();
    const meta = await client.getSpreadsheetMetadata();

    const subjects = await this.prisma.subject.findMany({
      include: {
        teachers: {
          select: {
            id: true,
            staffNo: true,
            fullName: true,
            email: true,
            phone: true,
            telegram: true,
            note: true,
          },
        },
      },
    });

    const sheetTitles = new Set(meta.sheetTitles);

    // Ensure every DB subject has a tab (two-way sync needs DB -> Sheets too)
    for (const subject of subjects) {
      const sheetName = subject.name.trim();
      if (!this.isAllowedSubjectTab(sheetName)) continue;

      if (!sheetTitles.has(sheetName)) {
        await client.createSheetTab({ title: sheetName });
        sheetTitles.add(sheetName);
        // Set header row for new tabs
        await client.setRowValues({
          sheetName,
          rowNumber: 1,
          values: TEACHERS_SHEET_HEADER,
        });
      }
    }

    for (const subject of subjects) {
      const sheetName = subject.name.trim();
      if (!sheetTitles.has(sheetName)) continue;

      const values = await client.getSheetValuesRange(sheetName, "A1:Z");
      if (values.length === 0) {
        await client.setRowValues({
          sheetName,
          rowNumber: 1,
          values: TEACHERS_SHEET_HEADER,
        });
      }

      const headerRow = (values[0] ?? []).length
        ? (values[0] ?? [])
        : TEACHERS_SHEET_HEADER;
      const keyToIndex: Record<string, number> = {};
      headerRow.forEach((h, i) => {
        const k = normalizeHeaderKey(String(h));
        if (k) keyToIndex[k] = i;
      });

      // If header is missing the critical columns, reset it so DB->Sheets sync can work.
      if (
        keyToIndex.teacher_uuid === undefined ||
        keyToIndex.fullname === undefined
      ) {
        await client.setRowValues({
          sheetName,
          rowNumber: 1,
          values: TEACHERS_SHEET_HEADER,
        });
        TEACHERS_SHEET_HEADER.forEach((h, i) => {
          keyToIndex[normalizeHeaderKey(h)] = i;
        });
      }

      const sheetUuidToRow = new Map<
        string,
        { rowIdx: number; row: string[] }
      >();
      for (let i = 1; i < values.length; i++) {
        const row = values[i] ?? [];
        const uuid = String(row[keyToIndex.teacher_uuid] ?? "").trim();
        if (uuid) sheetUuidToRow.set(uuid, { rowIdx: i + 1, row });
      }

      for (const teacher of subject.teachers) {
        const existing = sheetUuidToRow.get(teacher.id);

        const buildPayload = () => {
          const payload: Record<string, string> = {};
          const setIfChanged = (key: string, val: string | null) => {
            const idx = keyToIndex[key];
            if (idx === undefined) return;
            const newVal = val ?? "";
            const current = existing
              ? String(existing.row[idx] ?? "").trim()
              : "";
            if (current !== newVal) {
              payload[indexToColAlpha(idx)] = newVal;
            }
          };

          setIfChanged("fullname", teacher.fullName);
          setIfChanged("teacher_number", teacher.staffNo);
          setIfChanged("email", teacher.email);
          setIfChanged("phone", teacher.phone);
          setIfChanged("telegram", teacher.telegram);
          setIfChanged("note", teacher.note);
          setIfChanged("teacher_uuid", teacher.id);
          return payload;
        };

        const colToValue = buildPayload();
        if (Object.keys(colToValue).length > 0) {
          if (existing) {
            await client.batchUpdateCells({
              sheetName,
              rowNumber: existing.rowIdx,
              colToValue,
            });
          } else {
            const fullRow = new Array(headerRow.length).fill("");
            const setIn = (key: string, val: string | null) => {
              const idx = keyToIndex[key];
              if (idx !== undefined) fullRow[idx] = val ?? "";
            };
            setIn("teacher_uuid", teacher.id);
            setIn("fullname", teacher.fullName);
            setIn("teacher_number", teacher.staffNo);
            setIn("email", teacher.email);
            setIn("phone", teacher.phone);
            setIn("telegram", teacher.telegram);
            setIn("note", teacher.note);

            const now = new Date().toISOString();
            setIn("created_at", now);
            setIn("updated_at", now);

            await client.appendRow({
              sheetName,
              values: fullRow,
            });
          }
        }
      }
    }
  }

  async recordFailure(error: unknown) {
    const spreadsheetId = env.teachersSheetsSpreadsheetId ?? "unknown";

    const lastSyncAt = new Date();
    const message =
      typeof (error as any)?.message === "string"
        ? (error as any).message
        : String(error);

    await this.prisma.teachersSheetsSyncState.upsert({
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
}
