import type { PrismaClient, StudentStatus } from "@prisma/client";
import { createHash } from "crypto";
import { env } from "../../config/env";
import { StudentsSheetsClient } from "./StudentsSheetsClient";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseCsvIds(value: string): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseStatus(value: string): StudentStatus {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
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
  const v = String(value ?? "").trim();
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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
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

type HeaderIndex = {
  raw: string[];
  indexByName: Map<string, number>;
};

function buildHeaderIndex(headerRow: string[]): HeaderIndex {
  const indexByName = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const key = normalizeHeader(String(h ?? ""));
    if (!key) return;
    if (!indexByName.has(key)) indexByName.set(key, i);
  });
  return { raw: headerRow, indexByName };
}

export type ResolveStudentsSheetsConflictInput =
  | { resolution: "KEEP_SHEET" }
  | { resolution: "KEEP_DB" }
  | { resolution: "MERGE"; mergedPayload: any };

export class StudentsSheetsConflictService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(opts?: {
    status?: "OPEN" | "RESOLVED";
    take?: number;
    skip?: number;
  }) {
    const spreadsheetId = env.studentsSheetsSpreadsheetId;
    if (!spreadsheetId) return [];

    const take = Math.min(Math.max(opts?.take ?? 50, 1), 200);
    const skip = Math.max(opts?.skip ?? 0, 0);

    return this.prisma.studentsSheetsConflict.findMany({
      where: {
        spreadsheetId,
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: { detectedAt: "desc" },
      take,
      skip,
    });
  }

  async resolve(conflictId: string, input: ResolveStudentsSheetsConflictInput) {
    const conflict = await this.prisma.studentsSheetsConflict.findUnique({
      where: { id: conflictId },
    });
    if (!conflict) throw new Error("CONFLICT_NOT_FOUND");
    if (conflict.status !== "OPEN") throw new Error("CONFLICT_NOT_OPEN");

    const spreadsheetId = env.studentsSheetsSpreadsheetId;
    if (!spreadsheetId)
      throw new Error("STUDENTS_SHEETS_MISSING_SPREADSHEET_ID");
    if (conflict.spreadsheetId !== spreadsheetId) {
      throw new Error("CONFLICT_SPREADSHEET_MISMATCH");
    }

    const sheetPayload = (conflict.sheetPayload ?? null) as any;
    const dbPayload = (conflict.dbPayload ?? null) as any;

    const resolution = input.resolution;

    // Determine merged (final) payload when needed.
    const finalPayloadRaw =
      resolution === "KEEP_SHEET"
        ? sheetPayload
        : resolution === "KEEP_DB"
          ? dbPayload
          : (input as any).mergedPayload;

    if (!finalPayloadRaw || typeof finalPayloadRaw !== "object") {
      throw new Error("CONFLICT_MISSING_PAYLOAD");
    }

    const studentUuid = String(finalPayloadRaw.student_uuid ?? "").trim();
    if (!studentUuid || !UUID_REGEX.test(studentUuid)) {
      throw new Error("CONFLICT_PAYLOAD_INVALID_UUID");
    }

    const sheetTitle =
      String(finalPayloadRaw.group ?? "").trim() || conflict.sheetTitle || "";
    if (!sheetTitle) throw new Error("CONFLICT_MISSING_SHEET_TITLE");

    // Apply DB and/or Sheet updates depending on resolution.
    const client = new StudentsSheetsClient();

    const applyToDb = async () => {
      const cohort = String(finalPayloadRaw.cohort ?? "").trim() || null;
      const studentNumber =
        String(finalPayloadRaw.student_number ?? "").trim() || null;
      const fullName = String(finalPayloadRaw.fullname ?? "").trim();
      if (!fullName) throw new Error("CONFLICT_PAYLOAD_MISSING_FULLNAME");

      const email = String(finalPayloadRaw.email ?? "").trim() || null;
      const phone = String(finalPayloadRaw.phone ?? "").trim() || null;
      const status = parseStatus(String(finalPayloadRaw.status ?? ""));
      const teacherIds = parseCsvIds(String(finalPayloadRaw.teacher_ids ?? ""));
      const parentIds = parseCsvIds(String(finalPayloadRaw.parent_ids ?? ""));
      const note = String(finalPayloadRaw.note ?? "").trim() || null;

      const createdAt =
        parseDate(String(finalPayloadRaw.created_at ?? "")) ?? new Date();
      const updatedAt =
        parseDate(String(finalPayloadRaw.updated_at ?? "")) ?? new Date();

      // Ensure group exists.
      const group = await this.prisma.group.upsert({
        where: { name: sheetTitle },
        update: {},
        create: { name: sheetTitle },
        select: { id: true },
      });

      await this.prisma.student.upsert({
        where: { id: studentUuid },
        update: {
          studentNumber,
          fullName,
          email,
          phone,
          status,
          teacherIds,
          parentIds,
          cohort,
          groupName: sheetTitle,
          groupId: group.id,
          note,
          updatedAt,
        },
        create: {
          id: studentUuid,
          studentNumber,
          fullName,
          email,
          phone,
          status,
          teacherIds,
          parentIds,
          cohort,
          groupName: sheetTitle,
          groupId: group.id,
          note,
          createdAt,
          updatedAt,
        },
        select: { id: true },
      });
    };

    const applyToSheet = async () => {
      // Load header to map columns by name.
      const values = await client.getSheetValuesRange(sheetTitle, "A1:Z");
      const headerRow = (values[0] ?? []).map((v) => String(v ?? ""));
      const header = buildHeaderIndex(headerRow);

      const uuidIdx = header.indexByName.get("student_uuid");
      if (uuidIdx === undefined)
        throw new Error("SHEET_MISSING_STUDENT_UUID_COLUMN");

      // Find rowNumber if not recorded.
      let rowNumber = conflict.rowNumber ?? null;
      if (!rowNumber) {
        for (let i = 1; i < values.length; i++) {
          const row = values[i] ?? [];
          const v = String(row[uuidIdx] ?? "").trim();
          if (v === studentUuid) {
            rowNumber = i + 1;
            break;
          }
        }
      }
      if (!rowNumber) throw new Error("SHEET_ROW_NOT_FOUND_FOR_STUDENT");

      const colToValue: Record<string, string> = {};
      const set = (colName: string, value: string) => {
        const idx = header.indexByName.get(normalizeHeader(colName));
        if (idx === undefined) return;
        colToValue[colIndexToA1(idx)] = value;
      };

      set("student_uuid", studentUuid);
      set("student_number", String(finalPayloadRaw.student_number ?? ""));
      set("fullname", String(finalPayloadRaw.fullname ?? ""));
      set("email", String(finalPayloadRaw.email ?? ""));
      set("phone", String(finalPayloadRaw.phone ?? ""));
      set("status", String(finalPayloadRaw.status ?? ""));
      set("teacher_ids", String(finalPayloadRaw.teacher_ids ?? ""));
      set("parent_ids", String(finalPayloadRaw.parent_ids ?? ""));
      set("cohort", String(finalPayloadRaw.cohort ?? ""));
      set("created_at", String(finalPayloadRaw.created_at ?? ""));
      set("updated_at", String(finalPayloadRaw.updated_at ?? ""));
      set("note", String(finalPayloadRaw.note ?? ""));

      await client.batchUpdateCells({
        sheetName: sheetTitle,
        rowNumber,
        colToValue,
      });

      // Update row state to reflect final payload.
      const norm = normalizeSheetPayloadForHash({
        student_uuid: studentUuid,
        student_number: String(finalPayloadRaw.student_number ?? ""),
        fullname: String(finalPayloadRaw.fullname ?? ""),
        email: String(finalPayloadRaw.email ?? ""),
        phone: String(finalPayloadRaw.phone ?? ""),
        status: String(finalPayloadRaw.status ?? ""),
        teacher_ids: String(finalPayloadRaw.teacher_ids ?? ""),
        parent_ids: String(finalPayloadRaw.parent_ids ?? ""),
        cohort: String(finalPayloadRaw.cohort ?? ""),
        created_at: String(finalPayloadRaw.created_at ?? ""),
        updated_at: String(finalPayloadRaw.updated_at ?? ""),
        note: String(finalPayloadRaw.note ?? ""),
        group: sheetTitle,
      });
      const rowHash = sha256(norm);

      await this.prisma.studentsSheetsRowState.upsert({
        where: {
          spreadsheetId_sheetTitle_studentId: {
            spreadsheetId,
            sheetTitle,
            studentId: studentUuid,
          },
        },
        update: { rowNumber, rowHash, lastSeenAt: new Date(), deletedAt: null },
        create: {
          spreadsheetId,
          sheetTitle,
          studentId: studentUuid,
          rowNumber,
          rowHash,
          lastSeenAt: new Date(),
        },
        select: { id: true },
      });

      return { sheetTitle, rowNumber };
    };

    if (resolution === "KEEP_SHEET") {
      await applyToDb();
      await applyToSheet();
    } else if (resolution === "KEEP_DB") {
      await applyToSheet();
    } else {
      await applyToDb();
      await applyToSheet();
    }

    // Clear any pending outbox events for this student to avoid stale overwrites.
    await this.prisma.studentsSheetsOutboxEvent.deleteMany({
      where: { spreadsheetId, studentId: studentUuid },
    });

    const updated = await this.prisma.studentsSheetsConflict.update({
      where: { id: conflictId },
      data: {
        status: "RESOLVED",
        resolution,
        resolvedAt: new Date(),
        message: conflict.message,
      },
    });

    return updated;
  }
}
