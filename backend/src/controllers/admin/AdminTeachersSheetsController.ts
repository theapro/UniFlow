import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/responses";
import { jsonStringArray } from "../../utils/json";
import { TeachersSheetsClient } from "../../services/teachers-sheets/TeachersSheetsClient";
import { TeachersSheetsSyncService } from "../../services/teachers-sheets/TeachersSheetsSyncService";
import {
  SheetsSettingsService,
  maskSpreadsheetId,
} from "../../services/sheets/SheetsSettingsService";
import { formatGoogleSheetsConnectionError } from "../../services/sheets/googleSheetsError";

function maskEmail(email: string | undefined | null) {
  if (!email) return null;
  return email.replace(/(^.).*(@.*$)/, "$1***$2");
}

export class AdminTeachersSheetsController {
  private syncService: TeachersSheetsSyncService;
  private readonly sheetsSettings = new SheetsSettingsService();

  constructor() {
    this.syncService = new TeachersSheetsSyncService(prisma);
  }

  getSyncService() {
    return this.syncService;
  }

  patchConfig = async (req: Request, res: Response) => {
    const { spreadsheetId } = req.body ?? {};

    const settings = await this.sheetsSettings.patch(prisma, {
      teachersSpreadsheetId: spreadsheetId,
    });

    return ok(res, "Teachers Sheets config updated", {
      spreadsheetId: settings.effective.teachersSpreadsheetId,
      spreadsheetIdMasked: maskSpreadsheetId(
        settings.effective.teachersSpreadsheetId,
      ),
    });
  };

  getHealth = async (_req: Request, res: Response) => {
    const settings = await this.sheetsSettings.getOrCreate(prisma);
    const effectiveSpreadsheetId = settings.effective.teachersSpreadsheetId;

    const config = {
      enabled: env.teachersSheetsEnabled,
      spreadsheetId: effectiveSpreadsheetId,
      spreadsheetIdMasked: maskSpreadsheetId(effectiveSpreadsheetId),
      clientEmail: maskEmail(env.googleSheetsClientEmail),
      privateKeyProvided: Boolean(
        env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey,
      ),
      subjectTabsAllowRegex: env.teachersSheetsSubjectTabsAllowRegex ?? null,
      subjectTabsDenyRegex: env.teachersSheetsSubjectTabsDenyRegex ?? null,
    };

    const canAttemptConnection = Boolean(
      effectiveSpreadsheetId &&
      env.googleSheetsClientEmail &&
      (env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey),
    );

    if (!canAttemptConnection) {
      return ok(res, "Teachers Sheets health fetched", {
        config,
        connection: {
          attempted: false,
          ok: false,
          error: "TEACHERS_SHEETS_CONFIG_INCOMPLETE",
        },
      });
    }

    try {
      const client = new TeachersSheetsClient({
        spreadsheetId: effectiveSpreadsheetId ?? undefined,
      });
      const meta = await client.getSpreadsheetMetadata();

      return ok(res, "Teachers Sheets health fetched", {
        config,
        connection: {
          attempted: true,
          ok: true,
          spreadsheet: {
            id: meta.spreadsheetId,
            title: meta.title ?? null,
          },
          sheetTitles: meta.sheetTitles,
        },
      });
    } catch (error: any) {
      const message = formatGoogleSheetsConnectionError(error);

      return ok(res, "Teachers Sheets health fetched", {
        config,
        connection: {
          attempted: true,
          ok: false,
          error: message,
        },
      });
    }
  };

  getStatus = async (_req: Request, res: Response) => {
    const spreadsheetId =
      await this.sheetsSettings.getEffectiveTeachersSpreadsheetId(prisma);

    const state = spreadsheetId
      ? await prisma.teachersSheetsSyncState.findUnique({
          where: { spreadsheetId },
        })
      : null;

    const recentLogs = spreadsheetId
      ? await prisma.teachersSheetsSyncLog.findMany({
          where: { spreadsheetId },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    return ok(res, "Teachers Sheets status fetched", {
      enabled: env.teachersSheetsEnabled,
      spreadsheetId,
      spreadsheetIdMasked: maskSpreadsheetId(spreadsheetId),
      detectedSubjects: jsonStringArray(state?.detectedSubjects),
      syncedTeachers: state?.syncedTeachers ?? 0,
      spreadsheetRows: state?.spreadsheetRows ?? 0,
      lastRunId: state?.lastRunId ?? null,
      lastStatus: state?.lastStatus ?? null,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastError: state?.lastError ?? null,
      recentLogs: recentLogs.map((l) => ({
        createdAt: l.createdAt,
        level: l.level,
        direction: l.direction,
        action: l.action,
        sheetTitle: l.sheetTitle,
        teacherId: l.teacherId,
        message: l.message,
      })),
    });
  };

  syncNow = async (_req: Request, res: Response) => {
    const spreadsheetId =
      await this.sheetsSettings.getEffectiveTeachersSpreadsheetId(prisma);
    try {
      const result = await this.syncService.syncOnce({
        reason: "admin_force",
        spreadsheetId: spreadsheetId ?? undefined,
      });
      return ok(res, "Teachers Sheets sync completed", result);
    } catch (e: any) {
      await this.syncService.recordFailure(e, spreadsheetId ?? undefined);
      return fail(res, 500, "Teachers Sheets sync failed: " + e.message);
    }
  };

  syncDbToSheetsNow = async (_req: Request, res: Response) => {
    try {
      const result = await this.syncService.syncDbToSheets();
      return ok(res, "DB to Sheets sync completed", result);
    } catch (e: any) {
      return fail(res, 500, "DB to Sheets sync failed: " + e.message);
    }
  };
}
