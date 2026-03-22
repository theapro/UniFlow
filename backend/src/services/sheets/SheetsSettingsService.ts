import type { PrismaClient } from "@prisma/client";
import { env } from "../../config/env";

const SETTINGS_KEY = "default";

export type SheetsSettingsDto = {
  key: string;
  studentsSpreadsheetId: string | null;
  teachersSpreadsheetId: string | null;
  attendanceSpreadsheetId: string | null;
  gradesSpreadsheetId: string | null;

  // Effective values (DB override -> env fallback). Useful for health/status.
  effective: {
    studentsSpreadsheetId: string | null;
    teachersSpreadsheetId: string | null;
    attendanceSpreadsheetId: string | null;
    gradesSpreadsheetId: string | null;
  };
};

function normalizeId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s;
}

export function maskSpreadsheetId(id: string | undefined | null) {
  if (!id) return null;
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export class SheetsSettingsService {
  async getOrCreate(prisma: PrismaClient): Promise<SheetsSettingsDto> {
    const existing = await prisma.sheetsSettings.findUnique({
      where: { key: SETTINGS_KEY },
    });

    const row =
      existing ??
      (await prisma.sheetsSettings.create({
        data: {
          key: SETTINGS_KEY,
          studentsSpreadsheetId: null,
          teachersSpreadsheetId: null,
          attendanceSpreadsheetId: null,
          gradesSpreadsheetId: null,
        },
      }));

    const effective = {
      studentsSpreadsheetId:
        normalizeId(row.studentsSpreadsheetId) ??
        normalizeId(env.studentsSheetsSpreadsheetId),
      teachersSpreadsheetId:
        normalizeId(row.teachersSpreadsheetId) ??
        normalizeId(env.teachersSheetsSpreadsheetId),
      attendanceSpreadsheetId:
        normalizeId(row.attendanceSpreadsheetId) ??
        normalizeId(env.attendanceSheetsSpreadsheetId),
      gradesSpreadsheetId:
        normalizeId(row.gradesSpreadsheetId) ??
        normalizeId(env.gradesSheetsSpreadsheetId),
    };

    return {
      key: row.key,
      studentsSpreadsheetId: normalizeId(row.studentsSpreadsheetId),
      teachersSpreadsheetId: normalizeId(row.teachersSpreadsheetId),
      attendanceSpreadsheetId: normalizeId(row.attendanceSpreadsheetId),
      gradesSpreadsheetId: normalizeId(row.gradesSpreadsheetId),
      effective,
    };
  }

  async patch(
    prisma: PrismaClient,
    patch: {
      studentsSpreadsheetId?: unknown;
      teachersSpreadsheetId?: unknown;
      attendanceSpreadsheetId?: unknown;
      gradesSpreadsheetId?: unknown;
    },
  ): Promise<SheetsSettingsDto> {
    await prisma.sheetsSettings.upsert({
      where: { key: SETTINGS_KEY },
      update: {
        ...(patch.studentsSpreadsheetId !== undefined
          ? { studentsSpreadsheetId: normalizeId(patch.studentsSpreadsheetId) }
          : {}),
        ...(patch.teachersSpreadsheetId !== undefined
          ? { teachersSpreadsheetId: normalizeId(patch.teachersSpreadsheetId) }
          : {}),
        ...(patch.attendanceSpreadsheetId !== undefined
          ? {
              attendanceSpreadsheetId: normalizeId(
                patch.attendanceSpreadsheetId,
              ),
            }
          : {}),
        ...(patch.gradesSpreadsheetId !== undefined
          ? { gradesSpreadsheetId: normalizeId(patch.gradesSpreadsheetId) }
          : {}),
      },
      create: {
        key: SETTINGS_KEY,
        studentsSpreadsheetId:
          patch.studentsSpreadsheetId !== undefined
            ? normalizeId(patch.studentsSpreadsheetId)
            : null,
        teachersSpreadsheetId:
          patch.teachersSpreadsheetId !== undefined
            ? normalizeId(patch.teachersSpreadsheetId)
            : null,
        attendanceSpreadsheetId:
          patch.attendanceSpreadsheetId !== undefined
            ? normalizeId(patch.attendanceSpreadsheetId)
            : null,
        gradesSpreadsheetId:
          patch.gradesSpreadsheetId !== undefined
            ? normalizeId(patch.gradesSpreadsheetId)
            : null,
      },
    });

    return this.getOrCreate(prisma);
  }

  async getEffectiveStudentsSpreadsheetId(
    prisma: PrismaClient,
  ): Promise<string | null> {
    const settings = await this.getOrCreate(prisma);
    return settings.effective.studentsSpreadsheetId;
  }

  async getEffectiveTeachersSpreadsheetId(
    prisma: PrismaClient,
  ): Promise<string | null> {
    const settings = await this.getOrCreate(prisma);
    return settings.effective.teachersSpreadsheetId;
  }

  async getEffectiveAttendanceSpreadsheetId(
    prisma: PrismaClient,
  ): Promise<string | null> {
    const settings = await this.getOrCreate(prisma);
    return settings.effective.attendanceSpreadsheetId;
  }

  async getEffectiveGradesSpreadsheetId(
    prisma: PrismaClient,
  ): Promise<string | null> {
    const settings = await this.getOrCreate(prisma);
    return settings.effective.gradesSpreadsheetId;
  }
}
