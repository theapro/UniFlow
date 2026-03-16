import type {
  Prisma,
  PrismaClient,
  StudentStatus,
  StudentsSheetsLogDirection,
  StudentsSheetsLogLevel,
} from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { env } from "../../config/env";
import { jsonStringArray } from "../../utils/json";
import { StudentsSheetsClient } from "./StudentsSheetsClient";
import { STUDENTS_SHEET_COLUMNS } from "./studentsSheetColumns";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUIRED_COLUMNS = STUDENTS_SHEET_COLUMNS.map((c) => c.trim());

function compileRegex(value: string | undefined | null): RegExp | null {
  if (!value) return null;
  try {
    return new RegExp(value);
  } catch {
    return null;
  }
}

const GROUP_TABS_ALLOW_RE = compileRegex(env.studentsSheetsGroupTabsAllowRegex);
const GROUP_TABS_DENY_RE = compileRegex(env.studentsSheetsGroupTabsDenyRegex);

function isCandidateGroupTab(title: string): boolean {
  if (GROUP_TABS_ALLOW_RE && !GROUP_TABS_ALLOW_RE.test(title)) return false;
  if (GROUP_TABS_DENY_RE && GROUP_TABS_DENY_RE.test(title)) return false;
  return true;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseGroupTab(tabName: string): { cohortYear?: number } {
  const trimmed = tabName.trim();

  const m2 = /^([0-9]{2})([A-Za-z].*)?$/.exec(trimmed);
  if (m2) {
    const yy = Number(m2[1]);
    if (Number.isFinite(yy)) return { cohortYear: 2000 + yy };
  }

  const m4 = /^([0-9]{4})([A-Za-z].*)?$/.exec(trimmed);
  if (m4) {
    const yyyy = Number(m4[1]);
    if (Number.isFinite(yyyy)) return { cohortYear: yyyy };
  }

  return {};
}

function parseCsvIds(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStatus(value: string): StudentStatus {
  const v = value.trim().toLowerCase();
  switch (v) {
    case "active":
      return "ACTIVE";
    case "inactive":
      return "INACTIVE";
    case "graduated":
      return "GRADUATED";
    case "dropped":
      return "DROPPED";
    default:
      return "ACTIVE";
  }
}

function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function safeIso(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d.getTime();
  return Number.isNaN(t) ? "" : d.toISOString();
}

function isRowEmpty(row: string[]): boolean {
  return row.every((c) => c.trim() === "");
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

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizeIdsCsv(value: string): string {
  const ids = parseCsvIds(value);
  ids.sort();
  return ids.join(",");
}

function normalizeSheetPayloadForHash(payload: {
  student_uuid: string;
  student_number: string;
  fullname: string;
  email: string;
  phone: string;
  status: string;
  teacher_ids: string;
  parent_ids: string;
  cohort: string;
  created_at: string;
  updated_at: string;
  note: string;
  group: string;
}) {
  const createdAt = parseDate(payload.created_at);
  const updatedAt = parseDate(payload.updated_at);

  return {
    student_uuid: payload.student_uuid.trim(),
    student_number: payload.student_number.trim(),
    fullname: payload.fullname.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    status: parseStatus(payload.status),
    teacher_ids: normalizeIdsCsv(payload.teacher_ids),
    parent_ids: normalizeIdsCsv(payload.parent_ids),
    cohort: payload.cohort.trim(),
    created_at: safeIso(createdAt),
    updated_at: safeIso(updatedAt),
    note: payload.note.trim(),
    group: payload.group.trim(),
  };
}

type HeaderIndex = {
  raw: string[];
  indexByName: Map<string, number>;
};

function buildHeaderIndex(headerRow: string[]): HeaderIndex {
  const indexByName = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (!key) return;
    if (!indexByName.has(key)) indexByName.set(key, i);
  });
  return { raw: headerRow, indexByName };
}

function getCell(row: string[], header: HeaderIndex, colName: string): string {
  const idx = header.indexByName.get(normalizeHeader(colName));
  if (idx === undefined) return "";
  return String(row[idx] ?? "").trim();
}

function missingColumns(header: HeaderIndex): string[] {
  const missing: string[] = [];
  for (const c of REQUIRED_COLUMNS) {
    if (!header.indexByName.has(normalizeHeader(c))) missing.push(c);
  }
  return missing;
}

function formatDateForSheet(d: Date): string {
  return d.toISOString();
}

type UniqueConflictReason =
  | {
      kind: "DUPLICATE_STUDENT_UUID_ACROSS_TABS";
      student_uuid: string;
      occurrences: Array<{ sheetTitle: string; rowNumber: number }>;
    }
  | {
      kind: "DUPLICATE_STUDENT_NUMBER_ACROSS_TABS";
      student_uuid: string;
      student_number: string;
      occurrences: Array<{
        sheetTitle: string;
        rowNumber: number;
        student_uuid: string;
      }>;
    }
  | {
      kind: "DUPLICATE_EMAIL_ACROSS_TABS";
      student_uuid: string;
      email: string;
      occurrences: Array<{
        sheetTitle: string;
        rowNumber: number;
        student_uuid: string;
      }>;
    };

type RowRef = {
  sheetTitle: string;
  rowNumber: number;
  student_uuid: string;
  student_number: string | null;
  email: string | null;
};

function distinct<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export type StudentsSheetsSyncResult = {
  runId: string;
  spreadsheetId: string;
  groups: string[];
  sheetsRows: number;
  dbStudents: number;
  conflictsDetected: number;
  sheetsToDb: {
    processed: number;
    skipped: number;
    deletedDetected: number;
    headerMismatches: number;
  };
  dbToSheets: {
    eventsProcessed: number;
    eventsSucceeded: number;
    eventsFailed: number;
  };
};

export class StudentsSheetsSyncService {
  constructor(private readonly prisma: PrismaClient) {}

  async syncOnce(opts?: {
    reason?: string;
  }): Promise<StudentsSheetsSyncResult> {
    const runId = randomUUID();
    const client = new StudentsSheetsClient();
    const meta = await client.getSpreadsheetMetadata();

    const spreadsheetId = meta.spreadsheetId;
    const allSheetTitles = meta.sheetTitles;
    const now = new Date();

    const detectedGroupTabs: string[] = [];

    const logs: Prisma.StudentsSheetsSyncLogCreateManyInput[] = [];
    const log = (entry: {
      level?: StudentsSheetsLogLevel;
      direction: StudentsSheetsLogDirection;
      action: string;
      sheetTitle?: string;
      studentId?: string;
      message: string;
      meta?: any;
    }) => {
      logs.push({
        spreadsheetId,
        runId,
        level: entry.level ?? "INFO",
        direction: entry.direction,
        action: entry.action,
        sheetTitle: entry.sheetTitle ?? null,
        studentId: entry.studentId ?? null,
        message: entry.message,
        meta: entry.meta ?? undefined,
      });

      const prefix = `[SheetsSync]`;
      if (entry.level === "ERROR")
        console.error(prefix, entry.message, entry.meta ?? "");
      else if (entry.level === "WARN")
        console.warn(prefix, entry.message, entry.meta ?? "");
      else console.log(prefix, entry.message);
    };

    let sheetsRows = 0;
    let processed = 0;
    let skipped = 0;
    let deletedDetected = 0;
    let headerMismatches = 0;
    let conflictsDetected = 0;

    const sheetCache = new Map<
      string,
      {
        values: string[][];
        header: HeaderIndex;
        uuidToRowNumber: Map<string, number>;
      }
    >();

    const loadSheet = async (sheetTitle: string) => {
      const cached = sheetCache.get(sheetTitle);
      if (cached) return cached;

      const values = await client.getSheetValuesRange(sheetTitle, "A1:Z");
      const headerRow = values[0] ?? [];
      const header = buildHeaderIndex(headerRow.map((h) => String(h ?? "")));

      const uuidColIdx = header.indexByName.get("student_uuid");
      const uuidToRowNumber = new Map<string, number>();
      if (uuidColIdx !== undefined) {
        for (let i = 1; i < values.length; i++) {
          const rowNumber = i + 1;
          const row = values[i] ?? [];
          const studentUuid = String(row[uuidColIdx] ?? "").trim();
          if (studentUuid) uuidToRowNumber.set(studentUuid, rowNumber);
        }
      }

      const loaded = { values, header, uuidToRowNumber };
      sheetCache.set(sheetTitle, loaded);
      return loaded;
    };

    // --- Pre-scan: detect duplicate unique keys across tabs ---
    // Invariant: 1 student must belong to exactly 1 group tab.
    // If the same unique identifier appears in multiple tabs, we create an OPEN conflict
    // and skip automatic updates (prevents "last tab wins" overwrites).
    const conflictStudentIds = new Set<string>();
    const reasonsByStudentId = new Map<string, UniqueConflictReason[]>();

    const addReason = (studentId: string, reason: UniqueConflictReason) => {
      conflictStudentIds.add(studentId);
      const arr = reasonsByStudentId.get(studentId) ?? [];
      arr.push(reason);
      reasonsByStudentId.set(studentId, arr);
    };

    const uuidRefs = new Map<string, RowRef[]>();
    const studentNumberRefs = new Map<string, RowRef[]>();
    const emailRefs = new Map<string, RowRef[]>();

    const pushRef = (map: Map<string, RowRef[]>, key: string, ref: RowRef) => {
      const arr = map.get(key) ?? [];
      arr.push(ref);
      map.set(key, arr);
    };

    for (const tabTitle of allSheetTitles) {
      if (!isCandidateGroupTab(tabTitle)) continue;

      let sheet;
      try {
        sheet = await loadSheet(tabTitle);
      } catch {
        continue;
      }
      if (sheet.values.length === 0) continue;
      if (missingColumns(sheet.header).length > 0) continue;

      const tabValues = sheet.values;
      for (let i = 1; i < tabValues.length; i++) {
        const row = tabValues[i] ?? [];
        const rowNumber = i + 1;
        if (isRowEmpty(row)) continue;

        const studentUuid = getCell(row, sheet.header, "student_uuid");
        if (!studentUuid || !UUID_REGEX.test(studentUuid)) continue;

        const studentNumber =
          getCell(row, sheet.header, "student_number") || null;
        const email =
          (getCell(row, sheet.header, "email") || "").trim().toLowerCase() ||
          null;

        const ref: RowRef = {
          sheetTitle: tabTitle,
          rowNumber,
          student_uuid: studentUuid,
          student_number: studentNumber?.trim() || null,
          email,
        };

        pushRef(uuidRefs, studentUuid, ref);
        if (ref.student_number)
          pushRef(studentNumberRefs, ref.student_number, ref);
        if (ref.email) pushRef(emailRefs, ref.email, ref);
      }
    }

    const addDuplicateReasons = <T extends "uuid" | "student_number" | "email">(
      kind: T,
      key: string,
      refs: RowRef[],
    ) => {
      const distinctTabs = distinct(refs.map((r) => r.sheetTitle));
      if (distinctTabs.length <= 1) return;

      if (kind === "uuid") {
        const occurrences = refs.map((r) => ({
          sheetTitle: r.sheetTitle,
          rowNumber: r.rowNumber,
        }));
        const reasonBase: Omit<
          Extract<
            UniqueConflictReason,
            { kind: "DUPLICATE_STUDENT_UUID_ACROSS_TABS" }
          >,
          "student_uuid"
        > = {
          kind: "DUPLICATE_STUDENT_UUID_ACROSS_TABS",
          occurrences,
        };

        for (const r of refs)
          addReason(r.student_uuid, {
            ...reasonBase,
            student_uuid: r.student_uuid,
          });
        return;
      }

      if (kind === "student_number") {
        const occurrences = refs.map((r) => ({
          sheetTitle: r.sheetTitle,
          rowNumber: r.rowNumber,
          student_uuid: r.student_uuid,
        }));
        for (const r of refs) {
          addReason(r.student_uuid, {
            kind: "DUPLICATE_STUDENT_NUMBER_ACROSS_TABS",
            student_uuid: r.student_uuid,
            student_number: key,
            occurrences,
          });
        }
        return;
      }

      const occurrences = refs.map((r) => ({
        sheetTitle: r.sheetTitle,
        rowNumber: r.rowNumber,
        student_uuid: r.student_uuid,
      }));
      for (const r of refs) {
        addReason(r.student_uuid, {
          kind: "DUPLICATE_EMAIL_ACROSS_TABS",
          student_uuid: r.student_uuid,
          email: key,
          occurrences,
        });
      }
    };

    for (const [uuid, refs] of uuidRefs) {
      if (refs.length > 1) addDuplicateReasons("uuid", uuid, refs);
    }
    for (const [sn, refs] of studentNumberRefs) {
      const distinctStudents = distinct(refs.map((r) => r.student_uuid));
      if (distinctStudents.length > 1)
        addDuplicateReasons("student_number", sn, refs);
    }
    for (const [em, refs] of emailRefs) {
      const distinctStudents = distinct(refs.map((r) => r.student_uuid));
      if (distinctStudents.length > 1) addDuplicateReasons("email", em, refs);
    }

    if (reasonsByStudentId.size > 0) {
      for (const [studentId, reasons] of reasonsByStudentId) {
        conflictsDetected++;
        const first = reasons[0];
        const sheetTitle =
          first.kind === "DUPLICATE_STUDENT_UUID_ACROSS_TABS"
            ? first.occurrences[0]?.sheetTitle
            : (first as any).occurrences?.[0]?.sheetTitle;
        const rowNumber =
          first.kind === "DUPLICATE_STUDENT_UUID_ACROSS_TABS"
            ? first.occurrences[0]?.rowNumber
            : (first as any).occurrences?.[0]?.rowNumber;

        await this.prisma.studentsSheetsConflict.upsert({
          where: {
            spreadsheetId_studentId: { spreadsheetId, studentId },
          },
          update: {
            status: "OPEN",
            resolution: null,
            sheetTitle: sheetTitle ?? null,
            rowNumber: typeof rowNumber === "number" ? rowNumber : null,
            message:
              "Conflict detected: duplicate unique identifier across multiple group tabs",
            sheetPayload: {
              type: "DUPLICATE_UNIQUE_ACROSS_TABS",
              reasons,
            } as any,
            baseHash: null,
            detectedAt: now,
            resolvedAt: null,
          },
          create: {
            spreadsheetId,
            studentId,
            status: "OPEN",
            sheetTitle: sheetTitle ?? null,
            rowNumber: typeof rowNumber === "number" ? rowNumber : null,
            message:
              "Conflict detected: duplicate unique identifier across multiple group tabs",
            sheetPayload: {
              type: "DUPLICATE_UNIQUE_ACROSS_TABS",
              reasons,
            } as any,
            detectedAt: now,
          },
          select: { id: true },
        });
      }
    }

    // --- Sheets -> DB ---
    for (const groupTabName of allSheetTitles) {
      if (!isCandidateGroupTab(groupTabName)) {
        log({
          level: "INFO",
          direction: "SHEETS_TO_DB",
          action: "TAB_IGNORED",
          sheetTitle: groupTabName,
          message: `Ignored tab '${groupTabName}' (filtered by allow/deny regex)`,
        });
        continue;
      }

      let sheet;
      try {
        sheet = await loadSheet(groupTabName);
      } catch (e) {
        log({
          level: "ERROR",
          direction: "SHEETS_TO_DB",
          action: "SHEET_READ_FAILED",
          sheetTitle: groupTabName,
          message: `Failed to read sheet tab ${groupTabName}`,
          meta: { error: (e as any)?.message ?? String(e) },
        });
        continue;
      }

      if (sheet.values.length === 0) continue;
      const missing = missingColumns(sheet.header);
      if (missing.length > 0) {
        headerMismatches++;
        log({
          level: "WARN",
          direction: "SHEETS_TO_DB",
          action: "TAB_IGNORED",
          sheetTitle: groupTabName,
          message: `Ignored tab '${groupTabName}' (missing required columns: ${missing.join(", ")})`,
          meta: { header: sheet.header.raw },
        });
        continue;
      }

      detectedGroupTabs.push(groupTabName);

      const { cohortYear } = parseGroupTab(groupTabName);

      const cohortCode = cohortYear ? String(cohortYear).slice(-2) : null;

      const cohortId = cohortCode
        ? (
            await this.prisma.cohort.upsert({
              where: { code: cohortCode },
              update: {
                year: cohortYear ?? null,
              },
              create: {
                code: cohortCode,
                year: cohortYear ?? null,
                sortOrder: cohortYear ?? 0,
              },
              select: { id: true },
            })
          ).id
        : null;

      const group = await this.prisma.group.upsert({
        where: { name: groupTabName },
        update: {
          ...(cohortId ? { cohortId } : {}),
        },
        create: {
          name: groupTabName,
          ...(cohortId ? { cohortId } : {}),
        },
        select: { id: true },
      });

      const existingStates = await this.prisma.studentsSheetsRowState.findMany({
        where: { spreadsheetId, sheetTitle: groupTabName },
        select: { studentId: true, rowNumber: true, rowHash: true },
      });
      const stateByStudentId = new Map(
        existingStates.map((s) => [
          s.studentId,
          { rowNumber: s.rowNumber, rowHash: s.rowHash },
        ]),
      );

      const seenStudentIds = new Set<string>();
      const seenStudentIdsInTab = new Set<string>();
      const tabValues = sheet.values;

      for (let i = 1; i < tabValues.length; i++) {
        const row = tabValues[i] ?? [];
        const rowNumber = i + 1;

        if (isRowEmpty(row)) continue;

        let studentUuid = getCell(row, sheet.header, "student_uuid");
        const uuidColIdx = sheet.header.indexByName.get("student_uuid");

        // Missing UUID: generate and write back to sheet first, then proceed.
        if (!studentUuid) {
          if (uuidColIdx === undefined) {
            skipped++;
            log({
              level: "ERROR",
              direction: "SHEETS_TO_DB",
              action: "ROW_SKIPPED",
              sheetTitle: groupTabName,
              message: `Row ${rowNumber} skipped (missing student_uuid column)`,
            });
            continue;
          }

          const newUuid = randomUUID();
          try {
            await client.batchUpdateCells({
              sheetName: groupTabName,
              rowNumber,
              colToValue: {
                [colIndexToA1(uuidColIdx)]: newUuid,
              },
            });
            studentUuid = newUuid;
            // Update cached in-memory row values so downstream parsing/hashing is consistent.
            row[uuidColIdx] = newUuid;
            log({
              direction: "SHEETS_TO_DB",
              action: "UUID_GENERATED",
              sheetTitle: groupTabName,
              studentId: newUuid,
              message: `Generated missing student_uuid and wrote back to Sheets (row ${rowNumber})`,
            });
          } catch (e) {
            skipped++;
            log({
              level: "ERROR",
              direction: "SHEETS_TO_DB",
              action: "UUID_WRITEBACK_FAILED",
              sheetTitle: groupTabName,
              message: `Failed to write generated student_uuid to Sheets (row ${rowNumber})`,
              meta: { error: (e as any)?.message ?? String(e) },
            });
            continue;
          }
        }

        if (!UUID_REGEX.test(studentUuid)) {
          skipped++;
          log({
            level: "WARN",
            direction: "SHEETS_TO_DB",
            action: "ROW_SKIPPED",
            sheetTitle: groupTabName,
            message: `Row ${rowNumber} skipped (invalid UUID)`,
            meta: { student_uuid: studentUuid },
          });
          continue;
        }

        if (conflictStudentIds.has(studentUuid)) {
          skipped++;
          log({
            level: "WARN",
            direction: "SHEETS_TO_DB",
            action: "ROW_SKIPPED_CONFLICT",
            sheetTitle: groupTabName,
            studentId: studentUuid,
            message:
              "Row skipped due to OPEN conflict (duplicate unique identifier across tabs)",
          });
          continue;
        }

        if (seenStudentIdsInTab.has(studentUuid)) {
          skipped++;
          log({
            level: "ERROR",
            direction: "SHEETS_TO_DB",
            action: "DUPLICATE_UUID",
            sheetTitle: groupTabName,
            studentId: studentUuid,
            message: `Row ${rowNumber} skipped: student_uuid ${studentUuid} already exists in this tab`,
          });
          continue;
        }
        seenStudentIdsInTab.add(studentUuid);

        const studentNumber = getCell(row, sheet.header, "student_number");
        const studentEmail = getCell(row, sheet.header, "email");

        // Check for duplicate student number or email within the same tab
        const studentNoKey = studentNumber ? `SN:${studentNumber}` : null;
        const emailKey = studentEmail
          ? `EM:${studentEmail.toLowerCase()}`
          : null;

        if (studentNoKey && seenStudentIdsInTab.has(studentNoKey)) {
          skipped++;
          log({
            level: "ERROR",
            direction: "SHEETS_TO_DB",
            action: "DUPLICATE_STUDENT_NUMBER",
            sheetTitle: groupTabName,
            studentId: studentUuid,
            message: `Row ${rowNumber} skipped: student_number '${studentNumber}' is already used in this tab`,
          });
          continue;
        }
        if (emailKey && seenStudentIdsInTab.has(emailKey)) {
          skipped++;
          log({
            level: "ERROR",
            direction: "SHEETS_TO_DB",
            action: "DUPLICATE_EMAIL",
            sheetTitle: groupTabName,
            studentId: studentUuid,
            message: `Row ${rowNumber} skipped: email '${studentEmail}' is already used in this tab`,
          });
          continue;
        }

        if (studentNoKey) seenStudentIdsInTab.add(studentNoKey);
        if (emailKey) seenStudentIdsInTab.add(emailKey);

        sheetsRows++;
        seenStudentIds.add(studentUuid);

        const rowPayloadRaw = {
          student_uuid: studentUuid,
          student_number: getCell(row, sheet.header, "student_number"),
          fullname: getCell(row, sheet.header, "fullname"),
          email: getCell(row, sheet.header, "email"),
          phone: getCell(row, sheet.header, "phone"),
          status: getCell(row, sheet.header, "status"),
          teacher_ids: getCell(row, sheet.header, "teacher_ids"),
          parent_ids: getCell(row, sheet.header, "parent_ids"),
          cohort: getCell(row, sheet.header, "cohort"),
          created_at: getCell(row, sheet.header, "created_at"),
          updated_at: getCell(row, sheet.header, "updated_at"),
          note: getCell(row, sheet.header, "note"),
          group: groupTabName,
        };
        const rowPayloadNorm = normalizeSheetPayloadForHash(rowPayloadRaw);
        const rowHash = sha256(rowPayloadNorm);

        const prev = stateByStudentId.get(studentUuid);
        if (prev?.rowHash === rowHash) {
          // Check if DB changed while sheet stayed same
          const dbStudent = await this.prisma.student.findUnique({
            where: { id: studentUuid },
            include: { group: { select: { name: true } } },
          });

          const dbPayloadForHash = dbStudent
            ? {
                student_uuid: dbStudent.id,
                student_number: dbStudent.studentNumber ?? "",
                fullname: dbStudent.fullName,
                email: dbStudent.email ?? "",
                phone: dbStudent.phone ?? "",
                status: dbStudent.status,
                teacher_ids: jsonStringArray(dbStudent.teacherIds)
                  .sort()
                  .join(","),
                parent_ids: jsonStringArray(dbStudent.parentIds)
                  .sort()
                  .join(","),
                cohort: dbStudent.cohort ?? "",
                created_at: safeIso(dbStudent.createdAt),
                updated_at: safeIso(dbStudent.updatedAt),
                note: dbStudent.note ?? "",
                group: dbStudent.group?.name ?? dbStudent.groupName ?? "",
              }
            : null;

          const dbHash = dbPayloadForHash ? sha256(dbPayloadForHash) : null;
          if (dbHash && dbHash !== prev.rowHash) {
            // DB changed, but sheet is same as prev sync. DB should overwrite sheet via outbox.
            try {
              await this.prisma.studentsSheetsOutboxEvent.upsert({
                where: {
                  spreadsheetId_studentId: {
                    spreadsheetId,
                    studentId: studentUuid,
                  },
                },
                update: {
                  type: "UPSERT",
                  targetSheetTitle: groupTabName,
                  status: "PENDING",
                  nextAttemptAt: now,
                  lastError: null,
                },
                create: {
                  spreadsheetId,
                  studentId: studentUuid,
                  type: "UPSERT",
                  targetSheetTitle: groupTabName,
                  status: "PENDING",
                  nextAttemptAt: now,
                },
              });
            } catch (e) {
              // ignore outbox error
            }
          }

          await this.prisma.studentsSheetsRowState.update({
            where: {
              spreadsheetId_sheetTitle_studentId: {
                spreadsheetId,
                sheetTitle: groupTabName,
                studentId: studentUuid,
              },
            },
            data: { rowNumber, lastSeenAt: now, deletedAt: null },
            select: { id: true },
          });
          continue;
        }

        const fullName = rowPayloadRaw.fullname.trim();
        if (!fullName) {
          skipped++;
          log({
            level: "WARN",
            direction: "SHEETS_TO_DB",
            action: "ROW_SKIPPED",
            sheetTitle: groupTabName,
            studentId: studentUuid,
            message: `Row ${rowNumber} skipped (missing fullname)`,
          });
          continue;
        }

        const studentNumberVal = rowPayloadRaw.student_number.trim() || null;
        const emailVal = rowPayloadRaw.email.trim() || null;
        const phone = rowPayloadRaw.phone.trim() || null;
        const status = parseStatus(rowPayloadRaw.status);
        const teacherIds = parseCsvIds(rowPayloadRaw.teacher_ids);
        const parentIds = parseCsvIds(rowPayloadRaw.parent_ids);
        const cohort = rowPayloadRaw.cohort.trim() || null;

        // Ensure created_at/updated_at are valid and normalized in the sheet for robust conflict detection.
        const parsedCreatedAt = parseDate(rowPayloadRaw.created_at);
        const parsedUpdatedAt = parseDate(rowPayloadRaw.updated_at);
        const createdAt = parsedCreatedAt ?? now;
        const updatedAt = parsedUpdatedAt ?? now;

        const createdAtColIdx = sheet.header.indexByName.get("created_at");
        const updatedAtColIdx = sheet.header.indexByName.get("updated_at");
        const writeBack: Record<string, string> = {};
        if (!parsedCreatedAt && createdAtColIdx !== undefined) {
          writeBack[colIndexToA1(createdAtColIdx)] =
            formatDateForSheet(createdAt);
          row[createdAtColIdx] = writeBack[colIndexToA1(createdAtColIdx)];
        }
        if (!parsedUpdatedAt && updatedAtColIdx !== undefined) {
          writeBack[colIndexToA1(updatedAtColIdx)] =
            formatDateForSheet(updatedAt);
          row[updatedAtColIdx] = writeBack[colIndexToA1(updatedAtColIdx)];
        }

        if (Object.keys(writeBack).length > 0) {
          try {
            await client.batchUpdateCells({
              sheetName: groupTabName,
              rowNumber,
              colToValue: writeBack,
            });
          } catch (e) {
            log({
              level: "WARN",
              direction: "SHEETS_TO_DB",
              action: "TIMESTAMP_WRITEBACK_FAILED",
              sheetTitle: groupTabName,
              studentId: studentUuid,
              message: `Failed to normalize created_at/updated_at in Sheets (row ${rowNumber})`,
              meta: { error: (e as any)?.message ?? String(e) },
            });
          }
        }
        const note = rowPayloadRaw.note.trim() || null;

        // Conflict detection (three-way, hash-based):
        // If BOTH sheet and DB diverged from the last synced hash, create a conflict and skip automatic resolution.
        const prevBaseHash = prev?.rowHash ?? null;
        if (prevBaseHash) {
          const dbStudent = await this.prisma.student.findUnique({
            where: { id: studentUuid },
            include: { group: { select: { name: true } } },
          });

          const dbPayloadForHash = dbStudent
            ? {
                student_uuid: dbStudent.id,
                student_number: dbStudent.studentNumber ?? "",
                fullname: dbStudent.fullName,
                email: dbStudent.email ?? "",
                phone: dbStudent.phone ?? "",
                status: dbStudent.status,
                teacher_ids: jsonStringArray(dbStudent.teacherIds)
                  .sort()
                  .join(","),
                parent_ids: jsonStringArray(dbStudent.parentIds)
                  .sort()
                  .join(","),
                cohort: dbStudent.cohort ?? "",
                created_at: safeIso(dbStudent.createdAt),
                updated_at: safeIso(dbStudent.updatedAt),
                note: dbStudent.note ?? "",
                group: dbStudent.group?.name ?? dbStudent.groupName ?? "",
              }
            : null;

          const dbHash = dbPayloadForHash ? sha256(dbPayloadForHash) : null;
          const sheetChanged = rowHash !== prevBaseHash;
          const dbChanged = dbHash !== null ? dbHash !== prevBaseHash : true;

          if (sheetChanged && dbChanged) {
            conflictsDetected++;
            await this.prisma.studentsSheetsConflict.upsert({
              where: {
                spreadsheetId_studentId: {
                  spreadsheetId,
                  studentId: studentUuid,
                },
              },
              update: {
                status: "OPEN",
                resolution: null,
                sheetTitle: groupTabName,
                rowNumber,
                message:
                  "Conflict detected: sheet and DB both changed since last sync",
                sheetPayload: rowPayloadRaw as any,
                dbPayload: dbPayloadForHash as any,
                baseHash: prevBaseHash,
                detectedAt: now,
                resolvedAt: null,
              },
              create: {
                spreadsheetId,
                studentId: studentUuid,
                status: "OPEN",
                sheetTitle: groupTabName,
                rowNumber,
                message:
                  "Conflict detected: sheet and DB both changed since last sync",
                sheetPayload: rowPayloadRaw as any,
                dbPayload: dbPayloadForHash as any,
                baseHash: prevBaseHash,
                detectedAt: now,
              },
              select: { id: true },
            });

            log({
              level: "WARN",
              direction: "SHEETS_TO_DB",
              action: "CONFLICT_DETECTED",
              sheetTitle: groupTabName,
              studentId: studentUuid,
              message: `Conflict detected (row ${rowNumber}); requires admin resolution`,
            });
            continue;
          }

          // If DB changed but sheet didn't, ensure an outbox UPSERT exists (covers changes made outside Admin Panel too).
          if (!sheetChanged && dbChanged) {
            try {
              await this.prisma.studentsSheetsOutboxEvent.upsert({
                where: {
                  spreadsheetId_studentId: {
                    spreadsheetId,
                    studentId: studentUuid,
                  },
                },
                update: {
                  type: "UPSERT",
                  targetSheetTitle: groupTabName,
                  status: "PENDING",
                  nextAttemptAt: now,
                  lastError: null,
                },
                create: {
                  spreadsheetId,
                  studentId: studentUuid,
                  type: "UPSERT",
                  targetSheetTitle: groupTabName,
                  status: "PENDING",
                  nextAttemptAt: now,
                },
                select: { id: true },
              });
            } catch (e) {
              log({
                level: "WARN",
                direction: "DB_TO_SHEETS",
                action: "OUTBOX_ENQUEUE_FAILED",
                sheetTitle: groupTabName,
                studentId: studentUuid,
                message:
                  "Failed to enqueue outbox UPSERT for DB-changed student",
                meta: { error: (e as any)?.message ?? String(e) },
              });
            }
            continue;
          }
        }

        try {
          await this.prisma.student.upsert({
            where: { id: studentUuid },
            update: {
              studentNumber: studentNumberVal,
              fullName,
              email: emailVal,
              phone,
              status,
              teacherIds,
              parentIds,
              cohort,
              groupName: groupTabName,
              note,
              groupId: group.id,
              updatedAt,
            },
            create: {
              id: studentUuid,
              studentNumber: studentNumberVal,
              fullName,
              email: emailVal,
              phone,
              status,
              teacherIds,
              parentIds,
              cohort,
              groupName: groupTabName,
              note,
              groupId: group.id,
              createdAt,
              updatedAt,
            },
            select: { id: true },
          });
        } catch (e) {
          const code = (e as any)?.code;
          // Prisma unique constraint violation (e.g., studentNumber already used by another student)
          if (code === "P2002") {
            conflictsDetected++;
            await this.prisma.studentsSheetsConflict.upsert({
              where: {
                spreadsheetId_studentId: {
                  spreadsheetId,
                  studentId: studentUuid,
                },
              },
              update: {
                status: "OPEN",
                resolution: null,
                sheetTitle: groupTabName,
                rowNumber,
                message:
                  "Conflict detected: DB unique constraint violation while applying Sheets row",
                sheetPayload: rowPayloadRaw as any,
                baseHash: prev?.rowHash ?? null,
                detectedAt: now,
                resolvedAt: null,
              },
              create: {
                spreadsheetId,
                studentId: studentUuid,
                status: "OPEN",
                sheetTitle: groupTabName,
                rowNumber,
                message:
                  "Conflict detected: DB unique constraint violation while applying Sheets row",
                sheetPayload: rowPayloadRaw as any,
                detectedAt: now,
              },
              select: { id: true },
            });

            skipped++;
            log({
              level: "WARN",
              direction: "SHEETS_TO_DB",
              action: "CONFLICT_DETECTED",
              sheetTitle: groupTabName,
              studentId: studentUuid,
              message:
                "DB unique constraint violation; created conflict and skipped row",
              meta: { error: (e as any)?.message ?? String(e) },
            });
            continue;
          }
          throw e;
        }

        await this.prisma.studentsSheetsRowState.upsert({
          where: {
            spreadsheetId_sheetTitle_studentId: {
              spreadsheetId,
              sheetTitle: groupTabName,
              studentId: studentUuid,
            },
          },
          update: {
            rowNumber,
            rowHash,
            lastSeenAt: now,
            deletedAt: null,
          },
          create: {
            spreadsheetId,
            sheetTitle: groupTabName,
            studentId: studentUuid,
            rowNumber,
            rowHash,
            lastSeenAt: now,
          },
          select: { id: true },
        });

        processed++;
        log({
          direction: "SHEETS_TO_DB",
          action: "STUDENT_UPSERTED",
          sheetTitle: groupTabName,
          studentId: studentUuid,
          message: `Student upserted from Sheets (row ${rowNumber})`,
        });
      }

      if (env.studentsSheetsDetectDeletes) {
        const missingStates = existingStates.filter(
          (s) => !seenStudentIds.has(s.studentId),
        );

        if (missingStates.length > 0) {
          deletedDetected += missingStates.length;
          for (const st of missingStates) {
            await this.prisma.studentsSheetsRowState.update({
              where: {
                spreadsheetId_sheetTitle_studentId: {
                  spreadsheetId,
                  sheetTitle: groupTabName,
                  studentId: st.studentId,
                },
              },
              data: { deletedAt: now },
              select: { id: true },
            });

            await this.prisma.student.updateMany({
              where: { id: st.studentId, groupId: group.id },
              data: { status: "INACTIVE", groupId: null, updatedAt: now },
            });

            log({
              level: "WARN",
              direction: "SHEETS_TO_DB",
              action: "SHEET_ROW_DELETED",
              sheetTitle: groupTabName,
              studentId: st.studentId,
              message: "Row missing from Sheets; marked INACTIVE in DB",
            });
          }
        }
      }
    }

    // --- DB -> Sheets (outbox) ---
    let eventsProcessed = 0;
    let eventsSucceeded = 0;
    let eventsFailed = 0;

    if (env.studentsSheetsDbToSheetsEnabled) {
      const pending = await this.prisma.studentsSheetsOutboxEvent.findMany({
        where: {
          spreadsheetId,
          status: { in: ["PENDING", "FAILED"] },
          nextAttemptAt: { lte: now },
        },
        orderBy: { nextAttemptAt: "asc" },
        take: 50,
      });

      for (const ev of pending) {
        eventsProcessed++;
        const attempts = ev.attempts + 1;
        await this.prisma.studentsSheetsOutboxEvent.update({
          where: { id: ev.id },
          data: { status: "PROCESSING", attempts },
        });

        try {
          const openConflict =
            await this.prisma.studentsSheetsConflict.findUnique({
              where: {
                spreadsheetId_studentId: {
                  spreadsheetId,
                  studentId: ev.studentId,
                },
              },
              select: { status: true },
            });
          if (openConflict?.status === "OPEN") {
            const delayMs = 5 * 60_000;
            await this.prisma.studentsSheetsOutboxEvent.update({
              where: { id: ev.id },
              data: {
                status: "FAILED",
                lastError: "OPEN_CONFLICT",
                nextAttemptAt: new Date(Date.now() + delayMs),
              },
            });
            log({
              level: "WARN",
              direction: "DB_TO_SHEETS",
              action: "OUTBOX_SKIPPED_OPEN_CONFLICT",
              sheetTitle: ev.targetSheetTitle ?? undefined,
              studentId: ev.studentId,
              message:
                "Skipped outbox event because student has an OPEN conflict",
            });
            continue;
          }

          const activeRowStates =
            await this.prisma.studentsSheetsRowState.findMany({
              where: {
                spreadsheetId,
                studentId: ev.studentId,
                deletedAt: null,
              },
              select: { sheetTitle: true, rowNumber: true },
              orderBy: { lastSeenAt: "desc" },
              take: 20,
            });

          if (ev.type === "DELETE") {
            const candidateTitles = distinct(
              [
                ev.targetSheetTitle ?? null,
                typeof (ev.payload as any)?.group === "string"
                  ? String((ev.payload as any).group)
                  : null,
                ...activeRowStates.map((s) => s.sheetTitle),
              ].filter(Boolean) as string[],
            );

            if (candidateTitles.length === 0) {
              throw new Error("OUTBOX_DELETE_MISSING_SHEET_TITLE");
            }

            for (const sheetTitle of candidateTitles) {
              try {
                const sheet = await loadSheet(sheetTitle);
                const rowNumber =
                  sheet.uuidToRowNumber.get(ev.studentId) ??
                  activeRowStates.find((s) => s.sheetTitle === sheetTitle)
                    ?.rowNumber ??
                  null;

                if (rowNumber) {
                  // Prefer non-destructive clears to avoid reindexing large sheets.
                  await client.clearRow({ sheetName: sheetTitle, rowNumber });
                }
              } catch {
                // ignore; we'll still mark row states as deleted
              }

              await this.prisma.studentsSheetsRowState.updateMany({
                where: { spreadsheetId, sheetTitle, studentId: ev.studentId },
                data: { deletedAt: now },
              });
            }

            await this.prisma.studentsSheetsOutboxEvent.update({
              where: { id: ev.id },
              data: { status: "DONE", lastError: null },
            });

            eventsSucceeded++;
            log({
              direction: "DB_TO_SHEETS",
              action: "SHEET_ROW_CLEARED",
              sheetTitle: candidateTitles[0] ?? undefined,
              studentId: ev.studentId,
              message: "Cleared row in Sheets due to DB delete",
              meta: { clearedTabs: candidateTitles },
            });
            continue;
          }

          const student = await this.prisma.student.findUnique({
            where: { id: ev.studentId },
            include: { group: { select: { name: true } } },
          });

          if (!student) {
            await this.prisma.studentsSheetsOutboxEvent.update({
              where: { id: ev.id },
              data: {
                type: "DELETE",
                status: "PENDING",
                nextAttemptAt: now,
              },
            });
            continue;
          }

          const sheetTitle = student.group?.name ?? ev.targetSheetTitle ?? null;
          if (!sheetTitle) {
            throw new Error("OUTBOX_UPSERT_MISSING_SHEET_TITLE");
          }
          if (!allSheetTitles.includes(sheetTitle)) {
            throw new Error(`OUTBOX_UPSERT_UNKNOWN_TAB:${sheetTitle}`);
          }

          // Enforce invariant: a student should exist in exactly ONE group tab.
          // Clear any stale occurrences in other tabs (best-effort).
          const staleStates = activeRowStates.filter(
            (s) => s.sheetTitle !== sheetTitle,
          );
          for (const st of staleStates) {
            try {
              await client.clearRow({
                sheetName: st.sheetTitle,
                rowNumber: st.rowNumber,
              });
            } catch {
              // ignore
            }

            await this.prisma.studentsSheetsRowState.updateMany({
              where: {
                spreadsheetId,
                sheetTitle: st.sheetTitle,
                studentId: ev.studentId,
              },
              data: { deletedAt: now },
            });
          }

          const sheet = await loadSheet(sheetTitle);
          const missing = missingColumns(sheet.header);
          if (missing.length > 0) {
            throw new Error(
              `HEADER_MISMATCH:${sheetTitle}:${missing.join(",")}`,
            );
          }

          const payload = {
            student_uuid: student.id,
            student_number: student.studentNumber ?? "",
            fullname: student.fullName,
            email: student.email ?? "",
            phone: student.phone ?? "",
            status: student.status,
            teacher_ids: jsonStringArray(student.teacherIds).sort().join(","),
            parent_ids: jsonStringArray(student.parentIds).sort().join(","),
            cohort: student.cohort ?? "",
            created_at: formatDateForSheet(student.createdAt),
            updated_at: formatDateForSheet(student.updatedAt),
            note: student.note ?? "",
          };

          const colToValue: Record<string, string> = {};
          for (const [key, value] of Object.entries(payload)) {
            const idx = sheet.header.indexByName.get(normalizeHeader(key));
            if (idx === undefined) continue;
            colToValue[colIndexToA1(idx)] = String(value ?? "");
          }

          const existingRowNumber =
            sheet.uuidToRowNumber.get(student.id) ?? null;
          let rowNumber = existingRowNumber;

          if (rowNumber) {
            await client.batchUpdateCells({
              sheetName: sheetTitle,
              rowNumber,
              colToValue,
            });
          } else {
            const headerWidth = Math.max(sheet.header.raw.length, 26);
            const rowValues = Array.from({ length: headerWidth }, () => "");
            for (const [key, value] of Object.entries(payload)) {
              const idx = sheet.header.indexByName.get(normalizeHeader(key));
              if (idx === undefined) continue;
              rowValues[idx] = String(value ?? "");
            }
            rowNumber =
              (await client.appendRow({
                sheetName: sheetTitle,
                values: rowValues,
              })) ?? null;
          }

          const rowHash = sha256({ ...payload, group: sheetTitle });
          if (rowNumber) {
            await this.prisma.studentsSheetsRowState.upsert({
              where: {
                spreadsheetId_sheetTitle_studentId: {
                  spreadsheetId,
                  sheetTitle,
                  studentId: student.id,
                },
              },
              update: {
                rowNumber,
                rowHash,
                lastSeenAt: now,
                deletedAt: null,
              },
              create: {
                spreadsheetId,
                sheetTitle,
                studentId: student.id,
                rowNumber,
                rowHash,
                lastSeenAt: now,
              },
              select: { id: true },
            });
          }

          await this.prisma.studentsSheetsOutboxEvent.update({
            where: { id: ev.id },
            data: { status: "DONE", lastError: null },
          });

          eventsSucceeded++;
          log({
            direction: "DB_TO_SHEETS",
            action: existingRowNumber
              ? "SHEET_ROW_UPDATED"
              : "SHEET_ROW_APPENDED",
            sheetTitle,
            studentId: student.id,
            message: existingRowNumber
              ? "Updated row in Sheets from DB"
              : "Appended row in Sheets from DB",
          });

          // Best-effort formatting normalization on append: copy previous data row format.
          if (!existingRowNumber && rowNumber) {
            try {
              const fromRow = Math.max(2, rowNumber - 1);
              if (fromRow !== rowNumber) {
                await client.copyRowFormatting({
                  sheetName: sheetTitle,
                  fromRowNumber: fromRow,
                  toRowNumber: rowNumber,
                  fromColIndex0: 0,
                  toColIndex0: 26,
                });
              }
            } catch (e) {
              log({
                level: "WARN",
                direction: "DB_TO_SHEETS",
                action: "FORMAT_COPY_FAILED",
                sheetTitle,
                studentId: student.id,
                message: "Failed to copy row formatting after append",
                meta: { error: (e as any)?.message ?? String(e) },
              });
            }
          }
        } catch (e) {
          eventsFailed++;
          const errMsg = (e as any)?.message ?? String(e);
          const delayMs = Math.min(
            15 * 60_000,
            5_000 * Math.pow(2, Math.min(attempts, 8)),
          );
          await this.prisma.studentsSheetsOutboxEvent.update({
            where: { id: ev.id },
            data: {
              status: "FAILED",
              lastError: errMsg,
              nextAttemptAt: new Date(Date.now() + delayMs),
            },
          });

          log({
            level: "ERROR",
            direction: "DB_TO_SHEETS",
            action: "OUTBOX_EVENT_FAILED",
            sheetTitle: ev.targetSheetTitle ?? undefined,
            studentId: ev.studentId,
            message: "DB->Sheets outbox event failed",
            meta: { error: errMsg, attempts },
          });
        }
      }
    }

    const dbStudents = await this.prisma.student.count();

    const hadErrors =
      headerMismatches > 0 ||
      eventsFailed > 0 ||
      logs.some((l) => l.level === "ERROR");

    await this.prisma.studentsSheetsSyncState.upsert({
      where: { spreadsheetId },
      update: {
        lastRunId: runId,
        lastStatus: hadErrors ? "FAILED" : "SUCCESS",
        lastSyncAt: now,
        ...(hadErrors ? {} : { lastSuccessAt: now }),
        lastError: hadErrors ? "SEE_LOGS" : null,
        detectedGroups: detectedGroupTabs,
        syncedStudents: dbStudents,
        spreadsheetRows: sheetsRows,
      },
      create: {
        spreadsheetId,
        lastRunId: runId,
        lastStatus: hadErrors ? "FAILED" : "SUCCESS",
        lastSyncAt: now,
        lastSuccessAt: hadErrors ? null : now,
        lastError: hadErrors ? "SEE_LOGS" : null,
        detectedGroups: detectedGroupTabs,
        syncedStudents: dbStudents,
        spreadsheetRows: sheetsRows,
      },
      select: { id: true },
    });

    if (logs.length > 0) {
      // Best-effort persistence; avoid breaking sync on log writes.
      try {
        await this.prisma.studentsSheetsSyncLog.createMany({ data: logs });
      } catch (e) {
        console.warn("[SheetsSync] failed to persist logs", e);
      }
    }

    return {
      runId,
      spreadsheetId,
      groups: detectedGroupTabs,
      sheetsRows,
      dbStudents,
      conflictsDetected,
      sheetsToDb: {
        processed,
        skipped,
        deletedDetected,
        headerMismatches,
      },
      dbToSheets: {
        eventsProcessed,
        eventsSucceeded,
        eventsFailed,
      },
    };
  }

  async recordFailure(error: unknown) {
    const spreadsheetId = env.studentsSheetsSpreadsheetId ?? "unknown";

    const lastSyncAt = new Date();
    const message =
      typeof (error as any)?.message === "string"
        ? (error as any).message
        : String(error);

    await this.prisma.studentsSheetsSyncState.upsert({
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
