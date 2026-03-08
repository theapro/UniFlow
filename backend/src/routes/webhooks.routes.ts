import { Router } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ok, fail } from "../utils/responses";
import { StudentsSheetsSyncService } from "../services/students-sheets/StudentsSheetsSyncService";
import { AttendanceSheetsSyncService } from "../services/attendance-sheets/AttendanceSheetsSyncService";

const router = Router();

router.post("/students-sheets", async (req, res) => {
  const configured = env.studentsSheetsWebhookSecret;
  if (configured) {
    const provided =
      (typeof req.headers["x-uniflow-webhook-secret"] === "string"
        ? req.headers["x-uniflow-webhook-secret"]
        : undefined) ??
      (typeof req.query?.secret === "string" ? req.query.secret : undefined);

    if (!provided || provided !== configured) {
      return fail(res, 401, "Invalid webhook secret");
    }
  }

  // Fire-and-forget; worker will also pick up polling.
  setImmediate(async () => {
    const svc = new StudentsSheetsSyncService(prisma);
    try {
      await svc.syncOnce({ reason: "webhook" });
    } catch (e) {
      await svc.recordFailure(e);
    }
  });

  return ok(res, "Webhook accepted", { queued: true });
});

router.post("/attendance-sheets", async (req, res) => {
  const configured = env.attendanceSheetsWebhookSecret;
  if (configured) {
    const provided =
      (typeof req.headers["x-uniflow-webhook-secret"] === "string"
        ? req.headers["x-uniflow-webhook-secret"]
        : undefined) ??
      (typeof req.query?.secret === "string" ? req.query.secret : undefined);

    if (!provided || provided !== configured) {
      return fail(res, 401, "Invalid webhook secret");
    }
  }

  // Fire-and-forget; worker will also pick up polling.
  setImmediate(async () => {
    const svc = new AttendanceSheetsSyncService(prisma);
    try {
      await svc.syncOnce({ reason: "webhook" });
    } catch (e) {
      await svc.recordFailure(e);
    }
  });

  return ok(res, "Webhook accepted", { queued: true });
});

export default router;
