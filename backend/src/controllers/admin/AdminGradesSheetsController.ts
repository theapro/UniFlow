import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/responses";
import { GradesSheetsClient } from "../../services/grades-sheets/GradesSheetsClient";
import { GradesSheetsSyncService } from "../../services/grades-sheets/GradesSheetsSyncService";

function maskSpreadsheetId(id: string | undefined | null) {
  if (!id) return null;
  if (id.length <= 8) return "****";
  return id.slice(0, 4) + "…" + id.slice(-4);
}

function maskEmail(email: string | undefined | null) {
  if (!email) return null;
  const [u, d] = email.split("@");
  if (!u || !d) return "***";
  return u.slice(0, 2) + "***@" + d;
}

export class AdminGradesSheetsController {
  private lastRun:
    | (Awaited<ReturnType<GradesSheetsSyncService["syncOnce"]>> & {
        lastStatus: "SUCCESS" | "FAILED";
        lastError: string | null;
      })
    | null = null;

  getHealth = async (_req: Request, res: Response) => {
    const config = {
      enabled: env.gradesSheetsEnabled,
      spreadsheetId: env.gradesSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.gradesSheetsSpreadsheetId),
      clientEmail: maskEmail(env.googleSheetsClientEmail),
      privateKeyProvided: Boolean(
        env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey,
      ),
      tabsAllowRegex: env.gradesSheetsTabsAllowRegex ?? null,
      tabsDenyRegex: env.gradesSheetsTabsDenyRegex ?? null,
    };

    const canAttemptConnection = Boolean(
      env.gradesSheetsEnabled &&
      env.gradesSheetsSpreadsheetId &&
      env.googleSheetsClientEmail &&
      (env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey),
    );

    if (!canAttemptConnection) {
      return ok(res, "Grades Sheets health fetched", {
        config,
        connection: {
          attempted: false,
          ok: false,
          error: "GRADES_SHEETS_CONFIG_INCOMPLETE",
        },
      });
    }

    try {
      const client = new GradesSheetsClient();
      const meta = await client.getSpreadsheetMetadata();

      return ok(res, "Grades Sheets health fetched", {
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
      const message =
        typeof error?.message === "string"
          ? error.message
          : "SHEETS_HEALTH_FAILED";

      return ok(res, "Grades Sheets health fetched", {
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
    return ok(res, "Grades Sheets status fetched", {
      enabled: env.gradesSheetsEnabled,
      spreadsheetId: env.gradesSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.gradesSheetsSpreadsheetId),
      detectedTabs: this.lastRun?.detectedTabs ?? [],
      processedTabs: this.lastRun?.processedTabs ?? 0,
      spreadsheetRows: this.lastRun?.spreadsheetRows ?? 0,
      rosterAdded: this.lastRun?.rosterAdded ?? 0,
      rosterUpdated: this.lastRun?.rosterUpdated ?? 0,
      lastRunId: this.lastRun?.runId ?? null,
      lastStatus: this.lastRun?.lastStatus ?? null,
      lastSyncAt: this.lastRun?.finishedAt ?? null,
      lastError: this.lastRun?.lastError ?? null,
      errors: this.lastRun?.errors ?? [],
    });
  };

  syncNow = async (_req: Request, res: Response) => {
    const svc = new GradesSheetsSyncService(prisma);
    try {
      const result = await svc.syncOnce({ reason: "admin_sync" });
      this.lastRun = {
        ...result,
        lastStatus: result.hadErrors ? "FAILED" : "SUCCESS",
        lastError: result.hadErrors ? "SEE_ERRORS" : null,
      };
      return ok(res, "Grades Sheets sync completed", result);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : String(e);
      this.lastRun = {
        runId: this.lastRun?.runId ?? "unknown",
        spreadsheetId: env.gradesSheetsSpreadsheetId ?? "unknown",
        detectedTabs: this.lastRun?.detectedTabs ?? [],
        processedTabs: this.lastRun?.processedTabs ?? 0,
        spreadsheetRows: this.lastRun?.spreadsheetRows ?? 0,
        rosterAdded: this.lastRun?.rosterAdded ?? 0,
        rosterUpdated: this.lastRun?.rosterUpdated ?? 0,
        hadErrors: true,
        errors: [{ sheetTitle: "*", message: msg }],
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        lastStatus: "FAILED",
        lastError: msg,
      };
      return fail(res, 500, msg);
    }
  };

  forceSyncNow = async (_req: Request, res: Response) => {
    // For now this is equivalent to syncNow (manual sync). Kept separate to match admin UX.
    return this.syncNow(_req, res);
  };

  listTabs = async (_req: Request, res: Response) => {
    try {
      const svc = new GradesSheetsSyncService(prisma);
      const tabs = await svc.listTabs();
      return ok(res, "Grades Sheets tabs fetched", { items: tabs });
    } catch (err: any) {
      const msg = err?.message ?? "Failed to list grades tabs";
      if (
        msg === "GRADES_SHEETS_DISABLED" ||
        msg === "GRADES_SHEETS_MISSING_SPREADSHEET_ID" ||
        msg === "GRADES_SHEETS_MISSING_CLIENT_EMAIL" ||
        msg === "GRADES_SHEETS_MISSING_PRIVATE_KEY"
      ) {
        return fail(res, 400, msg);
      }
      return fail(res, 500, msg);
    }
  };

  previewTab = async (req: Request, res: Response) => {
    const sheetTitle =
      typeof req.query.sheetTitle === "string" ? req.query.sheetTitle : "";
    const takeRows =
      typeof req.query.takeRows === "string" ? Number(req.query.takeRows) : 60;

    try {
      const svc = new GradesSheetsSyncService(prisma);
      const preview = await svc.previewTab({ sheetTitle, takeRows });
      return ok(res, "Grades Sheets preview fetched", preview);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to preview grades tab";
      if (
        msg === "TAB_REQUIRED" ||
        msg === "GRADES_SHEETS_DISABLED" ||
        msg === "GRADES_SHEETS_MISSING_SPREADSHEET_ID" ||
        msg === "GRADES_SHEETS_MISSING_CLIENT_EMAIL" ||
        msg === "GRADES_SHEETS_MISSING_PRIVATE_KEY"
      ) {
        return fail(res, 400, msg);
      }
      return fail(res, 500, msg);
    }
  };

  updateTab = async (req: Request, res: Response) => {
    const sheetTitle =
      typeof req.body?.sheetTitle === "string" ? req.body.sheetTitle : "";
    const assignmentCount = req.body?.assignmentCount;
    const gradeValues = req.body?.gradeValues;
    const gradeStartRowNumber = req.body?.gradeStartRowNumber;

    try {
      const svc = new GradesSheetsSyncService(prisma);
      const result = await svc.updateTab({
        sheetTitle,
        assignmentCount,
        gradeValues: Array.isArray(gradeValues)
          ? (gradeValues as any)
          : undefined,
        gradeStartRowNumber:
          gradeStartRowNumber !== undefined
            ? Number(gradeStartRowNumber)
            : undefined,
      });
      return ok(res, "Grades tab updated", result);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to update grades tab";
      if (
        msg === "TAB_REQUIRED" ||
        msg === "INVALID_ASSIGNMENT_COUNT" ||
        msg === "ASSIGNMENT_COUNT_TOO_LARGE" ||
        msg === "GRADES_SHEETS_TAB_NOT_ALLOWED" ||
        msg === "GRADES_SHEETS_DISABLED" ||
        msg === "GRADES_SHEETS_MISSING_SPREADSHEET_ID" ||
        msg === "GRADES_SHEETS_MISSING_CLIENT_EMAIL" ||
        msg === "GRADES_SHEETS_MISSING_PRIVATE_KEY"
      ) {
        return fail(res, 400, msg);
      }
      return fail(res, 500, msg);
    }
  };
}
