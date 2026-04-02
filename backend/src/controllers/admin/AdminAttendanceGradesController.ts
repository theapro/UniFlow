import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { logError } from "../../utils/logger";
import { AdminAttendanceGradesService } from "../../services/admin";

export class AdminAttendanceGradesController {
  constructor(private readonly svc: AdminAttendanceGradesService) {}

  getMeta = async (_req: Request, res: Response) => {
    const meta = await this.svc.getMeta();
    return ok(res, "Attendance/Grades meta fetched", meta);
  };

  getAttendanceTable = async (req: Request, res: Response) => {
    try {
      const data = await this.svc.getAttendanceTable({
        cohortId:
          typeof req.query.cohortId === "string"
            ? req.query.cohortId
            : undefined,
        groupId: String(req.query.groupId ?? ""),
        subjectId: String(req.query.subjectId ?? ""),
        from: String(req.query.from ?? ""),
        to: String(req.query.to ?? ""),
      });
      return ok(res, "Attendance table fetched", data);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load attendance table";
      logError("AdminAttendanceGradesController", "getAttendanceTable failed", {
        message: msg,
      });
      return fail(res, 400, msg);
    }
  };

  saveAttendanceTable = async (req: Request, res: Response) => {
    try {
      const result = await this.svc.saveAttendanceTable({
        cohortId:
          typeof req.body?.cohortId === "string"
            ? req.body.cohortId
            : undefined,
        groupId: String(req.body?.groupId ?? ""),
        subjectId: String(req.body?.subjectId ?? ""),
        dates: Array.isArray(req.body?.dates) ? req.body.dates : [],
        records: Array.isArray(req.body?.records) ? req.body.records : [],
      });
      return ok(res, "Attendance table saved", result);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save attendance table";
      logError(
        "AdminAttendanceGradesController",
        "saveAttendanceTable failed",
        {
          message: msg,
        },
      );
      return fail(res, 400, msg);
    }
  };

  getGradesTable = async (req: Request, res: Response) => {
    try {
      const data = await this.svc.getGradesTable({
        cohortId:
          typeof req.query.cohortId === "string"
            ? req.query.cohortId
            : undefined,
        groupId: String(req.query.groupId ?? ""),
        subjectId: String(req.query.subjectId ?? ""),
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
      });
      return ok(res, "Grades table fetched", data);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load grades table";
      logError("AdminAttendanceGradesController", "getGradesTable failed", {
        message: msg,
      });
      return fail(res, 400, msg);
    }
  };

  saveGradesTable = async (req: Request, res: Response) => {
    try {
      const result = await this.svc.saveGradesTable({
        cohortId:
          typeof req.body?.cohortId === "string"
            ? req.body.cohortId
            : undefined,
        groupId: String(req.body?.groupId ?? ""),
        subjectId: String(req.body?.subjectId ?? ""),
        assignmentCount: Number(req.body?.assignmentCount),
        records: Array.isArray(req.body?.records) ? req.body.records : [],
      });
      return ok(res, "Grades table saved", result);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to save grades table";
      logError("AdminAttendanceGradesController", "saveGradesTable failed", {
        message: msg,
      });
      return fail(res, 400, msg);
    }
  };
}
