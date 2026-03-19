import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";
import { StudentsSheetsClient } from "./StudentsSheetsClient";
import { STUDENTS_SHEET_COLUMNS } from "./studentsSheetColumns";

const REQUIRED_COLUMNS = STUDENTS_SHEET_COLUMNS.map((c) => c.trim());

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function missingColumns(headerRow: string[]): string[] {
  const indexByName = new Set(
    headerRow.map((h) => normalizeHeader(String(h ?? ""))).filter(Boolean),
  );
  const missing: string[] = [];
  for (const c of REQUIRED_COLUMNS) {
    if (!indexByName.has(normalizeHeader(c))) missing.push(c);
  }
  return missing;
}

function compileRegex(value: string | undefined | null): RegExp | null {
  if (!value) return null;
  try {
    return new RegExp(value);
  } catch {
    return null;
  }
}

export type StudentsSheetsGroupsStatus = {
  enabled: boolean;
  spreadsheetId: string | null;
  allTabs: string[];
  validGroupTabs: string[];
  ignoredTabs: Array<{
    title: string;
    reason: "FILTERED" | "HEADER_MISMATCH";
    missingColumns?: string[];
  }>;
  dbGroups: Array<{ id: string; name: string }>;
  dbGroupsMissingTabs: Array<{ id: string; name: string }>;
  validTabsMissingDbGroups: string[];
};

export type StudentsSheetsGroupsSyncResult = {
  createdTabs: string[];
  createdDbGroups: string[];
  skippedExistingTabs: number;
  skippedExistingDbGroups: number;
};

export class StudentsSheetsGroupsService {
  private readonly allowRe = compileRegex(
    env.studentsSheetsGroupTabsAllowRegex,
  );
  private readonly denyRe = compileRegex(env.studentsSheetsGroupTabsDenyRegex);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly opts?: {
      spreadsheetId?: string;
    },
  ) {}

  private isCandidateTab(title: string): boolean {
    if (this.allowRe && !this.allowRe.test(title)) return false;
    if (this.denyRe && this.denyRe.test(title)) return false;
    return true;
  }

  async getGroupsStatus(): Promise<StudentsSheetsGroupsStatus> {
    if (!env.studentsSheetsEnabled) {
      return {
        enabled: false,
        spreadsheetId:
          this.opts?.spreadsheetId ?? env.studentsSheetsSpreadsheetId ?? null,
        allTabs: [],
        validGroupTabs: [],
        ignoredTabs: [],
        dbGroups: await this.prisma.group.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 5000,
        }),
        dbGroupsMissingTabs: [],
        validTabsMissingDbGroups: [],
      };
    }

    const client = new StudentsSheetsClient({
      spreadsheetId: this.opts?.spreadsheetId,
    });
    const meta = await client.getSpreadsheetMetadata();
    const allTabs = meta.sheetTitles;

    const validGroupTabs: string[] = [];
    const ignoredTabs: StudentsSheetsGroupsStatus["ignoredTabs"] = [];

    for (const title of allTabs) {
      if (!this.isCandidateTab(title)) {
        ignoredTabs.push({ title, reason: "FILTERED" });
        continue;
      }

      let headerRow: string[] = [];
      try {
        const values = await client.getSheetValuesRange(title, "A1:Z1");
        headerRow = (values[0] ?? []).map((v) => String(v ?? ""));
      } catch {
        // If we can't read the tab, treat it as ignored (sync will log errors separately).
        ignoredTabs.push({
          title,
          reason: "HEADER_MISMATCH",
          missingColumns: REQUIRED_COLUMNS,
        });
        continue;
      }

      const missing = missingColumns(headerRow);
      if (missing.length > 0) {
        ignoredTabs.push({
          title,
          reason: "HEADER_MISMATCH",
          missingColumns: missing,
        });
        continue;
      }

      validGroupTabs.push(title);
    }

    const dbGroups = await this.prisma.group.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 5000,
    });

    const tabSet = new Set(allTabs);
    const dbGroupsMissingTabs = dbGroups.filter((g) => !tabSet.has(g.name));
    const dbGroupNameSet = new Set(dbGroups.map((g) => g.name));
    const validTabsMissingDbGroups = validGroupTabs.filter(
      (t) => !dbGroupNameSet.has(t),
    );

    return {
      enabled: true,
      spreadsheetId: meta.spreadsheetId,
      allTabs,
      validGroupTabs,
      ignoredTabs,
      dbGroups,
      dbGroupsMissingTabs,
      validTabsMissingDbGroups,
    };
  }

  async ensureGroupTabExists(groupName: string): Promise<{ created: boolean }> {
    if (!env.studentsSheetsEnabled) return { created: false };

    const client = new StudentsSheetsClient({
      spreadsheetId: this.opts?.spreadsheetId,
    });
    const meta = await client.getSpreadsheetMetadata();
    if (meta.sheetTitles.includes(groupName)) return { created: false };

    await client.createSheetTab({ title: groupName });
    await client.setRowValues({
      sheetName: groupName,
      rowNumber: 1,
      values: [...STUDENTS_SHEET_COLUMNS],
      startColIndex0: 0,
    });

    return { created: true };
  }

  async renameGroupTab(opts: {
    fromName: string;
    toName: string;
  }): Promise<void> {
    if (!env.studentsSheetsEnabled) return;
    if (opts.fromName === opts.toName) return;

    const client = new StudentsSheetsClient({
      spreadsheetId: this.opts?.spreadsheetId,
    });
    const meta = await client.getSpreadsheetMetadata();
    const hasFrom = meta.sheetTitles.includes(opts.fromName);
    const hasTo = meta.sheetTitles.includes(opts.toName);

    if (hasTo) {
      // Destination already exists; avoid destructive rename.
      return;
    }

    if (hasFrom) {
      await client.renameSheetTab({
        fromTitle: opts.fromName,
        toTitle: opts.toName,
      });
      return;
    }

    // If old tab didn't exist, create a new one for the new name.
    await this.ensureGroupTabExists(opts.toName);
  }

  async deleteGroupTab(groupName: string): Promise<void> {
    if (!env.studentsSheetsEnabled) return;
    const client = new StudentsSheetsClient({
      spreadsheetId: this.opts?.spreadsheetId,
    });
    const meta = await client.getSpreadsheetMetadata();
    if (!meta.sheetTitles.includes(groupName)) return;
    await client.deleteSheetTab({ title: groupName });
  }

  async syncGroupsNow(): Promise<StudentsSheetsGroupsSyncResult> {
    const createdTabs: string[] = [];
    const createdDbGroups: string[] = [];
    let skippedExistingTabs = 0;
    let skippedExistingDbGroups = 0;

    if (!env.studentsSheetsEnabled) {
      return {
        createdTabs,
        createdDbGroups,
        skippedExistingTabs,
        skippedExistingDbGroups,
      };
    }

    const status = await this.getGroupsStatus();
    const allTabSet = new Set(status.allTabs);

    // DB -> Sheets: create tabs for DB groups that have none.
    for (const g of status.dbGroups) {
      if (allTabSet.has(g.name)) {
        skippedExistingTabs++;
        continue;
      }
      const { created } = await this.ensureGroupTabExists(g.name);
      if (created) createdTabs.push(g.name);
    }

    // Sheets -> DB: create DB groups for valid tabs missing in DB.
    for (const tab of status.validTabsMissingDbGroups) {
      const existing = await this.prisma.group.findUnique({
        where: { name: tab },
        select: { id: true },
      });
      if (existing) {
        skippedExistingDbGroups++;
        continue;
      }
      await this.prisma.group.create({
        data: { name: tab },
        select: { id: true },
      });
      createdDbGroups.push(tab);
    }

    return {
      createdTabs,
      createdDbGroups,
      skippedExistingTabs,
      skippedExistingDbGroups,
    };
  }
}
