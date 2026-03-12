import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ok } from "../../utils/responses";
import { jsonStringArray } from "../../utils/json";
import { StudentsSheetsClient } from "../../services/students-sheets/StudentsSheetsClient";
import { StudentsSheetsSyncService } from "../../services/students-sheets/StudentsSheetsSyncService";
import { StudentsSheetsConflictService } from "../../services/students-sheets/StudentsSheetsConflictService";
import { StudentsSheetsGroupsService } from "../../services/students-sheets/StudentsSheetsGroupsService";

function maskSpreadsheetId(id: string | undefined | null) {
  if (!id) return null;
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function maskEmail(email: string | undefined | null) {
  if (!email) return null;
  return email.replace(/(^.).*(@.*$)/, "$1***$2");
}

export class AdminStudentsSheetsController {
  getHealth = async (_req: Request, res: Response) => {
    const config = {
      enabled: env.studentsSheetsEnabled,
      workerEnabled: env.studentsSheetsWorkerEnabled,
      workerIntervalMs: env.studentsSheetsWorkerIntervalMs,
      spreadsheetId: env.studentsSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.studentsSheetsSpreadsheetId),
      clientEmail: maskEmail(env.googleSheetsClientEmail),
      privateKeyProvided: Boolean(
        env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey,
      ),
    };

    const canAttemptConnection = Boolean(
      env.studentsSheetsSpreadsheetId &&
      env.googleSheetsClientEmail &&
      (env.googleSheetsPrivateKeyBase64 || env.googleSheetsPrivateKey),
    );

    if (!canAttemptConnection) {
      return ok(res, "Students Sheets health fetched", {
        config,
        connection: {
          attempted: false,
          ok: false,
          error: "STUDENTS_SHEETS_CONFIG_INCOMPLETE",
        },
      });
    }

    try {
      const client = new StudentsSheetsClient();
      const meta = await client.getSpreadsheetMetadata();

      return ok(res, "Students Sheets health fetched", {
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

      return ok(res, "Students Sheets health fetched", {
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
    const spreadsheetId = env.studentsSheetsSpreadsheetId;

    const state = spreadsheetId
      ? await prisma.studentsSheetsSyncState.findUnique({
          where: { spreadsheetId },
        })
      : null;

    const worker = await prisma.studentsSheetsWorkerState.findUnique({
      where: { key: "students" },
    });

    const recentLogs = spreadsheetId
      ? await prisma.studentsSheetsSyncLog.findMany({
          where: { spreadsheetId },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

    const openConflicts = spreadsheetId
      ? await prisma.studentsSheetsConflict.count({
          where: { spreadsheetId, status: "OPEN" },
        })
      : 0;

    const heartbeatMs = worker?.lastHeartbeatAt
      ? Date.now() - worker.lastHeartbeatAt.getTime()
      : null;
    const workerRunning =
      typeof heartbeatMs === "number" &&
      heartbeatMs <= Math.max(env.studentsSheetsWorkerIntervalMs * 2, 60_000);

    return ok(res, "Students Sheets status fetched", {
      enabled: env.studentsSheetsEnabled,
      dbToSheetsEnabled: env.studentsSheetsDbToSheetsEnabled,
      detectDeletes: env.studentsSheetsDetectDeletes,
      spreadsheetId: env.studentsSheetsSpreadsheetId ?? null,
      spreadsheetIdMasked: maskSpreadsheetId(env.studentsSheetsSpreadsheetId),
      syncedStudents: state?.syncedStudents ?? 0,
      spreadsheetRows: state?.spreadsheetRows ?? 0,
      detectedGroups: jsonStringArray(state?.detectedGroups),
      lastRunId: state?.lastRunId ?? null,
      lastStatus: state?.lastStatus ?? null,
      lastSyncAt: state?.lastSyncAt ?? null,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastError: state?.lastError ?? null,
      openConflicts,
      worker: {
        enabled: env.studentsSheetsWorkerEnabled,
        intervalMs: env.studentsSheetsWorkerIntervalMs,
        lastHeartbeatAt: worker?.lastHeartbeatAt ?? null,
        running: workerRunning,
        lastError: worker?.lastError ?? null,
      },
      recentLogs: recentLogs.map((l) => ({
        createdAt: l.createdAt,
        level: l.level,
        direction: l.direction,
        action: l.action,
        sheetTitle: l.sheetTitle,
        studentId: l.studentId,
        message: l.message,
      })),
    });
  };

  syncNow = async (_req: Request, res: Response) => {
    const svc = new StudentsSheetsSyncService(prisma);
    try {
      const result = await svc.syncOnce({ reason: "admin_force" });
      return ok(res, "Students Sheets sync completed", result);
    } catch (e) {
      await svc.recordFailure(e);
      throw e;
    }
  };

  getGroupsStatus = async (_req: Request, res: Response) => {
    const svc = new StudentsSheetsGroupsService(prisma);
    const data = await svc.getGroupsStatus();
    return ok(res, "Students Sheets groups status fetched", data);
  };

  syncGroupsNow = async (_req: Request, res: Response) => {
    const svc = new StudentsSheetsGroupsService(prisma);
    const result = await svc.syncGroupsNow();
    return ok(res, "Students Sheets groups sync completed", result);
  };

  listConflicts = async (req: Request, res: Response) => {
    const status =
      req.query.status === "RESOLVED" || req.query.status === "OPEN"
        ? (req.query.status as "OPEN" | "RESOLVED")
        : "OPEN";
    const take = req.query.take ? Number(req.query.take) : 50;
    const skip = req.query.skip ? Number(req.query.skip) : 0;

    const svc = new StudentsSheetsConflictService(prisma);
    const conflicts = await svc.list({ status, take, skip });

    return ok(res, "Students Sheets conflicts fetched", {
      status,
      items: conflicts.map((c) => ({
        id: c.id,
        status: c.status,
        resolution: c.resolution,
        spreadsheetId: c.spreadsheetId,
        sheetTitle: c.sheetTitle,
        rowNumber: c.rowNumber,
        studentId: c.studentId,
        message: c.message,
        detectedAt: c.detectedAt,
        resolvedAt: c.resolvedAt,
      })),
    });
  };

  getConflict = async (req: Request, res: Response) => {
    const id = req.params.id;
    const conflict = await prisma.studentsSheetsConflict.findUnique({
      where: { id },
    });
    if (!conflict) throw new Error("CONFLICT_NOT_FOUND");

    return ok(res, "Students Sheets conflict fetched", conflict);
  };

  resolveConflict = async (req: Request, res: Response) => {
    const id = req.params.id;
    const body = req.body ?? {};

    const resolution = body.resolution;
    if (
      resolution !== "KEEP_SHEET" &&
      resolution !== "KEEP_DB" &&
      resolution !== "MERGE"
    ) {
      throw new Error("INVALID_RESOLUTION");
    }

    const svc = new StudentsSheetsConflictService(prisma);
    const updated =
      resolution === "MERGE"
        ? await svc.resolve(id, {
            resolution,
            mergedPayload: body.mergedPayload,
          })
        : await svc.resolve(id, { resolution });

    return ok(res, "Students Sheets conflict resolved", updated);
  };
}
