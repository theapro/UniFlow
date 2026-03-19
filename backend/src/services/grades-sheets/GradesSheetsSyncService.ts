import type { PrismaClient } from ".prisma/client";
import { env } from "../../config/env";
import { StudentsSheetsClient } from "../students-sheets/StudentsSheetsClient";
import { GradesSheetsClient } from "./GradesSheetsClient";
import { randomUUID } from "crypto";
import { syncGroupSubjectDerivedLinks } from "../sync/derivedRelations";

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

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
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

export type GradesRosterStudent = {
  student_uuid: string;
  student_number: string;
  fullname: string;
};

export type GradesSheetsSyncResult = {
  runId: string;
  spreadsheetId: string;
  detectedTabs: string[];
  processedTabs: number;
  spreadsheetRows: number;
  rosterAdded: number;
  rosterUpdated: number;
  hadErrors: boolean;
  errors: Array<{ sheetTitle: string; message: string }>;
  startedAt: string;
  finishedAt: string;
};

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

function parseScore(raw: string): { rawValue: string; score: number | null } {
  const rawValue = String(raw ?? "").trim();
  if (!rawValue) return { rawValue: "", score: null };

  // Accept both "85" and "85.5" and commas as decimal separator.
  const normalized = rawValue.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return { rawValue, score: null };
  return { rawValue, score: n };
}

export class GradesSheetsSyncService {
  constructor(private readonly prisma?: PrismaClient) {}

  private resolveGradesSpreadsheetId(spreadsheetIdOverride?: string): string {
    const spreadsheetId =
      spreadsheetIdOverride ?? env.gradesSheetsSpreadsheetId;
    if (!spreadsheetId) {
      throw new Error("GRADES_SHEETS_MISSING_SPREADSHEET_ID");
    }
    return spreadsheetId;
  }

  private createGradesClient(
    spreadsheetIdOverride?: string,
  ): GradesSheetsClient {
    const spreadsheetId = this.resolveGradesSpreadsheetId(
      spreadsheetIdOverride,
    );
    return new GradesSheetsClient({ spreadsheetId });
  }

  private async upsertGradesToDb(opts: {
    sheetTitle: string;
    groupName: string;
    subjectName: string;
    values: string[][];
  }): Promise<void> {
    if (!this.prisma) return;

    const headerRow = opts.values?.[0] ?? [];
    const assignmentCount = this.detectAssignmentCountFromHeader(headerRow);
    if (assignmentCount <= 0) return;

    const group = await this.prisma.group.findFirst({
      where: { name: { equals: opts.groupName } },
      select: { id: true, name: true },
    });
    if (!group) {
      throw new Error(`GROUP_NOT_FOUND:${opts.groupName}`);
    }

    const subject = await this.prisma.subject.findFirst({
      where: { name: { equals: opts.subjectName } },
      select: { id: true, name: true },
    });
    if (!subject) {
      throw new Error(`SUBJECT_NOT_FOUND:${opts.subjectName}`);
    }

    const gradeBook = await this.prisma.gradeBook.upsert({
      where: {
        groupId_subjectId: { groupId: group.id, subjectId: subject.id },
      },
      create: {
        groupId: group.id,
        subjectId: subject.id,
        assignmentCount,
        source: "GRADES_SHEETS",
      },
      update: {
        assignmentCount,
        source: "GRADES_SHEETS",
      },
      select: { id: true },
    });

    // Keep derived relations in sync (teachers<->subject, students.teacherIds)
    try {
      await syncGroupSubjectDerivedLinks(this.prisma, {
        groupId: group.id,
        subjectId: subject.id,
      });
    } catch {
      // Non-fatal
    }

    // Map roster rows -> student IDs that belong to this group.
    const rosterStudentIds = Array.from(
      new Set(
        (opts.values ?? [])
          .slice(1)
          .map((r) => String(r?.[0] ?? "").trim())
          .filter(Boolean),
      ),
    );

    if (rosterStudentIds.length === 0) return;

    const allowedStudents = await this.prisma.student.findMany({
      where: {
        id: { in: rosterStudentIds },
        groupId: group.id,
      },
      select: { id: true },
    });

    const allowedSet = new Set(allowedStudents.map((s) => s.id));

    // Replace all records for this gradeBook in one go to keep sync deterministic.
    await this.prisma.gradeRecord.deleteMany({
      where: { gradeBookId: gradeBook.id },
    });

    const rowsToCreate: Array<{
      gradeBookId: string;
      studentId: string;
      assignmentIndex: number;
      rawValue: string | null;
      score: number | null;
    }> = [];

    for (let r = 1; r < (opts.values ?? []).length; r++) {
      const row = opts.values[r] ?? [];
      const studentId = String(row[0] ?? "").trim();
      if (!studentId) continue;
      if (!allowedSet.has(studentId)) continue;

      for (let i = 0; i < assignmentCount; i++) {
        const cell = String(row[3 + i] ?? "");
        const parsed = parseScore(cell);
        if (!parsed.rawValue) continue; // skip empty cells

        rowsToCreate.push({
          gradeBookId: gradeBook.id,
          studentId,
          assignmentIndex: i + 1,
          rawValue: parsed.rawValue,
          score: parsed.score,
        });
      }
    }

    if (rowsToCreate.length === 0) return;

    // Chunk to avoid query size limits.
    const CHUNK = 2_000;
    for (let i = 0; i < rowsToCreate.length; i += CHUNK) {
      const slice = rowsToCreate.slice(i, i + CHUNK);
      await this.prisma.gradeRecord.createMany({
        data: slice,
      });
    }
  }

  private isAllowedTab(title: string): boolean {
    const t = normalizeTitle(title);
    if (!t) return false;
    const allow = compileOptionalRegex(env.gradesSheetsTabsAllowRegex);
    const deny = compileOptionalRegex(env.gradesSheetsTabsDenyRegex);
    if (allow && !allow.test(t)) return false;
    if (deny && deny.test(t)) return false;
    return t.includes("_");
  }

  private assertEnabled(spreadsheetIdOverride?: string) {
    if (!env.gradesSheetsEnabled) {
      throw new Error("GRADES_SHEETS_DISABLED");
    }

    this.resolveGradesSpreadsheetId(spreadsheetIdOverride);
  }

  private getPrivateKeyProvided(): boolean {
    return Boolean(
      env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey,
    );
  }

  private assertCredentials() {
    if (!env.googleSheetsClientEmail) {
      throw new Error("GRADES_SHEETS_MISSING_CLIENT_EMAIL");
    }
    if (!this.getPrivateKeyProvided()) {
      throw new Error("GRADES_SHEETS_MISSING_PRIVATE_KEY");
    }
  }

  private detectAssignmentCountFromHeader(headerRow: string[]): number {
    const rest = (headerRow ?? []).slice(3);
    let count = 0;
    for (const cell of rest) {
      const v = String(cell ?? "").trim();
      if (!v) break;
      if (/^HW\d+$/i.test(v)) count++;
      else break;
    }
    return count;
  }

  private async ensureHwHeaders(opts: {
    client: GradesSheetsClient;
    sheetTitle: string;
    assignmentCount: number;
  }): Promise<{ previous: number; ensured: number; increasedBy: number }> {
    const desired = Math.floor(Number(opts.assignmentCount));
    if (!Number.isFinite(desired) || desired <= 0) {
      throw new Error("INVALID_ASSIGNMENT_COUNT");
    }
    if (desired > 200) {
      throw new Error("ASSIGNMENT_COUNT_TOO_LARGE");
    }

    const header = await opts.client.getSheetValuesRange(
      opts.sheetTitle,
      "A1:ZZ1",
    );
    const headerRow = header?.[0] ?? [];
    const existing = this.detectAssignmentCountFromHeader(headerRow);

    // Always rewrite the HW header segment D..(D+max(existing,desired)-1) so that:
    // - increasing adds HW columns
    // - decreasing clears extra HW header labels (does NOT touch grade values below)
    const segmentLen = Math.max(existing, desired);
    const hwSegment = Array.from({ length: segmentLen }, (_v, i) => {
      const n = i + 1;
      return n <= desired ? `HW${n}` : "";
    });

    await opts.client.setRangeValues({
      sheetName: opts.sheetTitle,
      startRowNumber: 1,
      startColIndex0: 3,
      values: [hwSegment],
      valueInputOption: "RAW",
    });

    return {
      previous: existing,
      ensured: desired,
      increasedBy: Math.max(0, desired - existing),
    };
  }

  private async syncTabRoster(opts: {
    client: GradesSheetsClient;
    sheetTitle: string;
    groupTabTitle: string;
    studentsSpreadsheetId?: string;
  }): Promise<{
    spreadsheetRows: number;
    rosterAdded: number;
    rosterUpdated: number;
  }> {
    const roster = await this.readRosterFromStudentsGroupTab({
      groupTabTitle: opts.groupTabTitle,
      spreadsheetId: opts.studentsSpreadsheetId,
    });

    // Only control A-C (do NOT overwrite HW columns)
    await opts.client.setRowValues({
      sheetName: opts.sheetTitle,
      rowNumber: 1,
      values: ["student_uuid", "student_number", "fullname"],
      startColIndex0: 0,
    });

    // Build existing UUID -> rowNumber mapping (A column only)
    const existing = await opts.client.getSheetValuesRange(
      opts.sheetTitle,
      "A1:C",
    );
    const rosterRowByStudentUuid = new Map<string, number>();
    for (let r = 1; r < existing.length; r++) {
      const row = existing[r] ?? [];
      const uuid = String(row[0] ?? "").trim();
      if (uuid) rosterRowByStudentUuid.set(uuid, r + 1);
    }

    let rosterAdded = 0;
    let rosterUpdated = 0;

    for (const s of roster) {
      const rowNumber = rosterRowByStudentUuid.get(s.student_uuid) ?? null;
      const payload = [s.student_uuid, s.student_number ?? "", s.fullname];

      if (rowNumber) {
        await opts.client.setRowValues({
          sheetName: opts.sheetTitle,
          rowNumber,
          values: payload,
          startColIndex0: 0,
        });
        rosterUpdated++;
      } else {
        await opts.client.appendRow({
          sheetName: opts.sheetTitle,
          values: payload,
        });
        rosterAdded++;
      }
    }

    return {
      spreadsheetRows: existing.length + rosterAdded,
      rosterAdded,
      rosterUpdated,
    };
  }

  private async readRosterFromStudentsGroupTab(opts: {
    groupTabTitle: string;
    spreadsheetId?: string;
  }): Promise<GradesRosterStudent[]> {
    if (!env.studentsSheetsEnabled) {
      throw new Error("STUDENTS_SHEETS_DISABLED");
    }

    const groupTabTitle = normalizeTitle(opts.groupTabTitle);
    if (!groupTabTitle) throw new Error("GROUP_TAB_REQUIRED");

    const studentsClient = new StudentsSheetsClient({
      spreadsheetId: opts.spreadsheetId ?? undefined,
    });
    const values = await studentsClient.getSheetValuesRange(
      groupTabTitle,
      "A1:K",
    );

    if (values.length === 0) return [];

    const header = buildHeaderIndex(values[0] ?? []);

    // We only need these three fields; if missing, fallback to A-C by index.
    const hasUuid = header.indexByName.has("student_uuid");
    const hasNumber = header.indexByName.has("student_number");
    const hasFullname = header.indexByName.has("fullname");

    const roster: GradesRosterStudent[] = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r] ?? [];

      const student_uuid = hasUuid
        ? getCell(row, header, "student_uuid")
        : String(row[0] ?? "").trim();
      const student_number = hasNumber
        ? getCell(row, header, "student_number")
        : String(row[1] ?? "").trim();
      const fullname = hasFullname
        ? getCell(row, header, "fullname")
        : String(row[2] ?? "").trim();

      if (!student_uuid && !student_number && !fullname) continue;
      if (!student_uuid) continue; // uuid is mandatory for downstream matching

      roster.push({
        student_uuid,
        student_number,
        fullname,
      });
    }

    return roster;
  }

  async ensureTabAndHwColumns(opts: {
    sheetTitle: string;
    groupTabTitle: string;
    assignmentCount: number;
    spreadsheetId?: string;
    studentsSpreadsheetId?: string;
  }): Promise<{
    sheetTitle: string;
    createdTab: boolean;
    rosterAdded: number;
    rosterUpdated: number;
  }> {
    this.assertEnabled(opts.spreadsheetId);

    const sheetTitle = normalizeTitle(opts.sheetTitle);
    if (!sheetTitle) throw new Error("TAB_REQUIRED");
    if (!this.isAllowedTab(sheetTitle)) {
      throw new Error("GRADES_SHEETS_TAB_NOT_ALLOWED");
    }

    const assignmentCount = Number(opts.assignmentCount);
    if (!Number.isFinite(assignmentCount) || assignmentCount <= 0) {
      throw new Error("INVALID_ASSIGNMENT_COUNT");
    }

    const roster = await this.readRosterFromStudentsGroupTab({
      groupTabTitle: opts.groupTabTitle,
      spreadsheetId: opts.studentsSpreadsheetId,
    });

    const client = this.createGradesClient(opts.spreadsheetId);
    const meta = await client.getSpreadsheetMetadata();

    let createdTab = false;
    if (!meta.sheetTitles.map((t) => normalizeTitle(t)).includes(sheetTitle)) {
      await client.createSheetTab({ title: sheetTitle });
      createdTab = true;
    }

    // Header row
    if (createdTab) {
      const hwHeaders = Array.from(
        { length: assignmentCount },
        (_, i) => `HW${i + 1}`,
      );
      await client.setRowValues({
        sheetName: sheetTitle,
        rowNumber: 1,
        values: ["student_uuid", "student_number", "fullname", ...hwHeaders],
        startColIndex0: 0,
      });
    } else {
      // Only control A-C (do NOT overwrite HW columns if already exists)
      await client.setRowValues({
        sheetName: sheetTitle,
        rowNumber: 1,
        values: ["student_uuid", "student_number", "fullname"],
        startColIndex0: 0,
      });
    }

    // Build existing UUID -> rowNumber mapping (A column only)
    const existing = await client.getSheetValuesRange(sheetTitle, "A1:C");
    const rosterRowByStudentUuid = new Map<string, number>();
    for (let r = 1; r < existing.length; r++) {
      const row = existing[r] ?? [];
      const uuid = String(row[0] ?? "").trim();
      if (uuid) rosterRowByStudentUuid.set(uuid, r + 1);
    }

    let rosterAdded = 0;
    let rosterUpdated = 0;

    for (const s of roster) {
      const rowNumber = rosterRowByStudentUuid.get(s.student_uuid) ?? null;
      const payload = [s.student_uuid, s.student_number ?? "", s.fullname];

      if (rowNumber) {
        await client.setRowValues({
          sheetName: sheetTitle,
          rowNumber,
          values: payload,
          startColIndex0: 0,
        });
        rosterUpdated++;
      } else {
        await client.appendRow({ sheetName: sheetTitle, values: payload });
        rosterAdded++;
      }
    }

    return { sheetTitle, createdTab, rosterAdded, rosterUpdated };
  }

  async syncOnce(opts?: {
    reason?: string;
    spreadsheetId?: string;
    studentsSpreadsheetId?: string;
  }): Promise<GradesSheetsSyncResult> {
    this.assertEnabled(opts?.spreadsheetId);
    this.assertCredentials();

    const runId = randomUUID();
    const startedAt = new Date();

    const client = this.createGradesClient(opts?.spreadsheetId);
    const meta = await client.getSpreadsheetMetadata();

    const detectedTabs = meta.sheetTitles
      .map((t) => normalizeTitle(t))
      .filter(Boolean)
      .filter((t) => this.isAllowedTab(t));

    let processedTabs = 0;
    let spreadsheetRows = 0;
    let rosterAdded = 0;
    let rosterUpdated = 0;
    const errors: Array<{ sheetTitle: string; message: string }> = [];

    for (const sheetTitle of detectedTabs) {
      const parsed = parseTabTitle(sheetTitle);
      if (!parsed) continue;

      try {
        // Read full tab once for grade persistence.
        const values = await client.getSheetValuesRange(sheetTitle, "A1:ZZ");

        const res = await this.syncTabRoster({
          client,
          sheetTitle,
          groupTabTitle: parsed.groupName,
          studentsSpreadsheetId: opts?.studentsSpreadsheetId,
        });

        // Optional: persist grades to DB when Prisma is provided.
        // This keeps AI tools purely Prisma-backed (no direct Sheets reads).
        await this.upsertGradesToDb({
          sheetTitle,
          groupName: parsed.groupName,
          subjectName: parsed.subjectName,
          values,
        });

        processedTabs++;
        spreadsheetRows += res.spreadsheetRows;
        rosterAdded += res.rosterAdded;
        rosterUpdated += res.rosterUpdated;
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        errors.push({ sheetTitle, message: msg });
      }
    }

    const finishedAt = new Date();

    return {
      runId,
      spreadsheetId: meta.spreadsheetId,
      detectedTabs,
      processedTabs,
      spreadsheetRows,
      rosterAdded,
      rosterUpdated,
      hadErrors: errors.length > 0,
      errors: errors.slice(0, 20),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }

  async updateTab(opts: {
    sheetTitle: string;
    assignmentCount?: number;
    gradeValues?: string[][];
    gradeStartRowNumber?: number;
    spreadsheetId?: string;
  }): Promise<{
    sheetTitle: string;
    assignmentCountPrevious: number | null;
    assignmentCountEnsured: number | null;
    assignmentCountIncreasedBy: number;
    updatedGradeCells: number;
  }> {
    this.assertEnabled(opts.spreadsheetId);
    this.assertCredentials();

    const sheetTitle = normalizeTitle(opts.sheetTitle);
    if (!sheetTitle) throw new Error("TAB_REQUIRED");
    if (!this.isAllowedTab(sheetTitle)) {
      throw new Error("GRADES_SHEETS_TAB_NOT_ALLOWED");
    }

    const client = this.createGradesClient(opts.spreadsheetId);

    let assignmentCountPrevious: number | null = null;
    let assignmentCountEnsured: number | null = null;
    let assignmentCountIncreasedBy = 0;

    if (opts.assignmentCount !== undefined && opts.assignmentCount !== null) {
      const desired = Number(opts.assignmentCount);
      if (!Number.isFinite(desired) || desired <= 0) {
        throw new Error("INVALID_ASSIGNMENT_COUNT");
      }

      const ensured = await this.ensureHwHeaders({
        client,
        sheetTitle,
        assignmentCount: desired,
      });
      assignmentCountPrevious = ensured.previous;
      assignmentCountEnsured = ensured.ensured;
      assignmentCountIncreasedBy = ensured.increasedBy;
    }

    let updatedGradeCells = 0;
    if (Array.isArray(opts.gradeValues)) {
      const startRowNumber = Math.max(
        2,
        Math.floor(opts.gradeStartRowNumber ?? 2),
      );
      const rows = opts.gradeValues;
      const rowCount = rows.length;
      const colCount = Math.max(0, ...rows.map((r) => (r ?? []).length));

      if (rowCount > 0 && colCount > 0) {
        await client.setRangeValues({
          sheetName: sheetTitle,
          startRowNumber,
          startColIndex0: 3,
          values: rows,
          valueInputOption: "USER_ENTERED",
        });
        updatedGradeCells = rowCount * colCount;
      }
    }

    return {
      sheetTitle,
      assignmentCountPrevious,
      assignmentCountEnsured,
      assignmentCountIncreasedBy,
      updatedGradeCells,
    };
  }

  async listTabs(opts?: {
    spreadsheetId?: string;
  }): Promise<
    Array<{ sheetTitle: string; groupName: string; subjectName: string }>
  > {
    this.assertEnabled(opts?.spreadsheetId);

    const client = this.createGradesClient(opts?.spreadsheetId);
    const meta = await client.getSpreadsheetMetadata();

    const tabs = meta.sheetTitles
      .map((t) => normalizeTitle(t))
      .filter(Boolean)
      .filter((t) => this.isAllowedTab(t));

    const result: Array<{
      sheetTitle: string;
      groupName: string;
      subjectName: string;
    }> = [];

    for (const t of tabs) {
      const parsed = parseTabTitle(t);
      if (!parsed) continue;
      result.push({
        sheetTitle: t,
        groupName: parsed.groupName,
        subjectName: parsed.subjectName,
      });
    }

    return result;
  }

  async previewTab(opts: {
    sheetTitle: string;
    takeRows?: number;
    spreadsheetId?: string;
  }) {
    this.assertEnabled(opts.spreadsheetId);

    const sheetTitle = normalizeTitle(opts.sheetTitle);
    if (!sheetTitle) throw new Error("TAB_REQUIRED");

    const client = this.createGradesClient(opts.spreadsheetId);
    const values = await client.getSheetValuesRange(sheetTitle, "A1:ZZ");

    const take = Math.min(Math.max(opts.takeRows ?? 25, 1), 200);
    return {
      sheetTitle,
      rows: values.slice(0, take),
    };
  }
}
