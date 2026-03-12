import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { created, fail, ok } from "../../utils/responses";
import { jsonStringArray } from "../../utils/json";
import { AttendanceSheetsClient } from "../../services/attendance-sheets/AttendanceSheetsClient";
import { AttendanceSheetsSyncService } from "../../services/attendance-sheets/AttendanceSheetsSyncService";

function maskSpreadsheetId(id: string | undefined | null) {
  if (!id) return null;
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function maskEmail(email: string | undefined | null) {
  if (!email) return null;
  return email.replace(/(^.).*(@.*$)/, "$1***$2");
}

export class AdminAttendanceSheetsController {
  getHealth = async (_req: Request, res: Response) => {
    const config = {
      enabled: env.attendanceSheetsEnabled,
      workerEnabled: env.attendanceSheetsWorkerEnabled,
      workerIntervalMs: env.attendanceSheetsWorkerIntervalMs,
      spreadsheetId: env.attendanceSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.attendanceSheetsSpreadsheetId),
      clientEmail: maskEmail(env.googleSheetsClientEmail),
      privateKeyProvided: Boolean(
        env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey,
      ),
      tabsAllowRegex: env.attendanceSheetsTabsAllowRegex ?? null,
      tabsDenyRegex: env.attendanceSheetsTabsDenyRegex ?? null,
      dateFormat: env.attendanceSheetsDateFormat,
    };

    const canAttemptConnection = Boolean(
      env.attendanceSheetsSpreadsheetId &&
      env.googleSheetsClientEmail &&
      (env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey),
    );

    if (!canAttemptConnection) {
      return ok(res, "Attendance Sheets health fetched", {
        config,
        connection: {
          attempted: false,
          ok: false,
          error: "ATTENDANCE_SHEETS_CONFIG_INCOMPLETE",
        },
      });
    }

    try {
      const client = new AttendanceSheetsClient();
      const meta = await client.getSpreadsheetMetadata();

      return ok(res, "Attendance Sheets health fetched", {
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

      return ok(res, "Attendance Sheets health fetched", {
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
    const spreadsheetId = env.attendanceSheetsSpreadsheetId;

    const state = spreadsheetId
      ? await prisma.attendanceSheetsSyncState.findUnique({
          where: { spreadsheetId },
        })
      : null;

    const worker = await prisma.attendanceSheetsWorkerState.findUnique({
      where: { key: "attendance" },
    });

    const recentLogs = (
      spreadsheetId
        ? await prisma.attendanceSheetsSyncLog.findMany({
            where: { spreadsheetId },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : []
    ) as any[];

    const heartbeatMs = worker?.lastHeartbeatAt
      ? Date.now() - worker.lastHeartbeatAt.getTime()
      : null;
    const workerRunning =
      typeof heartbeatMs === "number" &&
      heartbeatMs <= Math.max(env.attendanceSheetsWorkerIntervalMs * 2, 60_000);

    return ok(res, "Attendance Sheets status fetched", {
      enabled: env.attendanceSheetsEnabled,
      dbToSheetsEnabled: env.attendanceSheetsDbToSheetsEnabled,
      spreadsheetId: env.attendanceSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.attendanceSheetsSpreadsheetId),
      detectedTabs: jsonStringArray(state?.detectedTabs),
      processedTabs: state?.processedTabs ?? 0,
      syncedLessons: state?.syncedLessons ?? 0,
      syncedRecords: state?.syncedRecords ?? 0,
      rosterAdded: state?.rosterAdded ?? 0,
      rosterUpdated: state?.rosterUpdated ?? 0,
      spreadsheetRows: state?.spreadsheetRows ?? 0,
      lastRunId: state?.lastRunId ?? null,
      lastStatus: state?.lastStatus ?? null,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastError: state?.lastError ?? null,
      worker: {
        enabled: env.attendanceSheetsWorkerEnabled,
        intervalMs: env.attendanceSheetsWorkerIntervalMs,
        lastHeartbeatAt: worker?.lastHeartbeatAt ?? null,
        running: workerRunning,
        lastError: worker?.lastError ?? null,
      },
      recentLogs: recentLogs.map((l: any) => ({
        createdAt: l.createdAt,
        level: l.level,
        direction: l.direction,
        action: l.action,
        sheetTitle: l.sheetTitle,
        message: l.message,
      })),
    });
  };

  syncNow = async (_req: Request, res: Response) => {
    const svc = new AttendanceSheetsSyncService(prisma);
    try {
      const result = await svc.syncOnce({ reason: "admin_force" });
      return ok(res, "Attendance Sheets sync completed", result);
    } catch (e) {
      await svc.recordFailure(e);
      throw e;
    }
  };

  listTabs = async (_req: Request, res: Response) => {
    const svc = new AttendanceSheetsSyncService(prisma);
    const tabs = await svc.listTabs();
    return ok(res, "Attendance Sheets tabs fetched", { items: tabs });
  };

  createTab = async (req: Request, res: Response) => {
    const { groupId, subjectId, dates, assignmentCount } = req.body ?? {};

    if (!groupId || !subjectId || !Array.isArray(dates)) {
      return fail(res, 400, "groupId, subjectId, dates[] are required");
    }

    const assignmentCountProvided =
      assignmentCount !== undefined &&
      assignmentCount !== null &&
      assignmentCount !== "";
    const n = assignmentCountProvided ? Number(assignmentCount) : undefined;
    if (assignmentCountProvided && (!Number.isFinite(n) || (n ?? 0) <= 0)) {
      return fail(res, 400, "assignmentCount must be a positive number");
    }

    const cleanedDates = (dates as any[])
      .map((d) => String(d ?? "").trim())
      .filter(Boolean);

    if (cleanedDates.length === 0) {
      return fail(res, 400, "At least one date is required");
    }

    const svc = new AttendanceSheetsSyncService(prisma);
    const result = await svc.ensureTabAndDates({
      groupId: String(groupId),
      subjectId: String(subjectId),
      dates: cleanedDates,
      assignmentCount: n,
    });

    return created(res, "Attendance Sheets tab ensured", result);
  };

  previewTab = async (req: Request, res: Response) => {
    const sheetTitle =
      typeof req.query.sheetTitle === "string" ? req.query.sheetTitle : "";
    const takeRows =
      typeof req.query.takeRows === "string" ? Number(req.query.takeRows) : 25;

    const svc = new AttendanceSheetsSyncService(prisma);
    const preview = await svc.previewTab({ sheetTitle, takeRows });
    return ok(res, "Attendance Sheets preview fetched", preview);
  };
}
