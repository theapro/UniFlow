import type { Request, Response } from "express";
import { AdminAttendanceService } from "../../services/admin/AdminAttendanceService";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { AttendanceSheetsSyncService } from "../../services/attendance-sheets/AttendanceSheetsSyncService";
import { created, fail, ok } from "../../utils/responses";
import { logError } from "../../utils/logger";

export class AdminAttendanceController {
  constructor(private readonly attendanceService: AdminAttendanceService) {}

  list = async (req: Request, res: Response) => {
    try {
      const lessonId =
        typeof req.query.lessonId === "string" ? req.query.lessonId : undefined;
      const studentId =
        typeof req.query.studentId === "string"
          ? req.query.studentId
          : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const attendance = await this.attendanceService.list({
        lessonId,
        studentId,
        take,
        skip,
      });
      return ok(res, "Attendance records fetched", attendance);
    } catch (err) {
      logError("AdminAttendanceController", "list failed", {
        requestId: (req as any).requestId,
        query: req.query,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to fetch attendance");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const record = await this.attendanceService.getById(req.params.id);
      if (!record) {
        return fail(res, 404, "Attendance record not found");
      }
      return ok(res, "Attendance record fetched", record);
    } catch (err) {
      logError("AdminAttendanceController", "getById failed", {
        requestId: (req as any).requestId,
        params: req.params,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to fetch attendance record");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { lessonId, studentId, status } = req.body ?? {};

      if (!lessonId || !studentId || !status) {
        return fail(res, 400, "lessonId, studentId, status are required");
      }

      const record = await this.attendanceService.create({
        lessonId,
        studentId,
        status,
      });

      return created(res, "Attendance record created", record);
    } catch (err) {
      logError("AdminAttendanceController", "create failed", {
        requestId: (req as any).requestId,
        body: req.body,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to create attendance record");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { status } = req.body ?? {};

      const record = await this.attendanceService.update(req.params.id, {
        ...(status !== undefined ? { status } : {}),
      });

      return ok(res, "Attendance record updated", record);
    } catch (err) {
      logError("AdminAttendanceController", "update failed", {
        requestId: (req as any).requestId,
        params: req.params,
        body: req.body,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to update attendance record");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.attendanceService.remove(req.params.id);
      return ok(res, "Attendance record deleted");
    } catch (err) {
      logError("AdminAttendanceController", "remove failed", {
        requestId: (req as any).requestId,
        params: req.params,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to delete attendance record");
    }
  };

  bulkMark = async (req: Request, res: Response) => {
    try {
      const { lessonId, records } = req.body ?? {};

      if (!lessonId || !Array.isArray(records)) {
        return fail(res, 400, "lessonId and records array are required");
      }

      const result = await this.attendanceService.bulkMarkAttendance(
        lessonId,
        records,
      );
      return created(res, "Attendance marked in bulk", result);
    } catch (err) {
      logError("AdminAttendanceController", "bulkMark failed", {
        requestId: (req as any).requestId,
        body: req.body,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to mark attendance in bulk");
    }
  };

  getByDate = async (req: Request, res: Response) => {
    try {
      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : "";
      const subjectId =
        typeof req.query.subjectId === "string" ? req.query.subjectId : "";
      const date = typeof req.query.date === "string" ? req.query.date : "";

      if (!groupId || !subjectId || !date) {
        return fail(res, 400, "groupId, subjectId, date are required");
      }

      const records = await this.attendanceService.getAttendanceByDate({
        groupId,
        subjectId,
        date,
      });
      return ok(res, "Attendance fetched", records);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to fetch attendance";
      if (
        msg === "INVALID_DATE" ||
        msg === "MISSING_TEACHER_FOR_LESSON" ||
        msg === "GROUP_NOT_FOUND" ||
        msg === "SUBJECT_NOT_FOUND"
      ) {
        return fail(res, 400, msg);
      }

      logError("AdminAttendanceController", "getByDate failed", {
        requestId: (req as any).requestId,
        query: req.query,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to fetch attendance");
    }
  };

  bulkMarkByDate = async (req: Request, res: Response) => {
    try {
      const { groupId, subjectId, date, records } = req.body ?? {};

      if (!groupId || !subjectId || !date || !Array.isArray(records)) {
        return fail(res, 400, "groupId, subjectId, date, records are required");
      }

      const result = await this.attendanceService.bulkMarkAttendanceByDate({
        groupId,
        subjectId,
        date,
        records,
      });

      // Best-effort: push the updated day back to Attendance Sheets (DB -> Sheets)
      if (
        env.attendanceSheetsEnabled &&
        env.attendanceSheetsDbToSheetsEnabled
      ) {
        const svc = new AttendanceSheetsSyncService(prisma);
        svc
          .pushAttendanceByDateToSheet({ groupId, subjectId, date })
          .catch((err) => {
            logError(
              "AttendanceSheetsSync",
              "pushAttendanceByDateToSheet failed",
              {
                requestId: (req as any).requestId,
                groupId,
                subjectId,
                date,
                error: err,
              },
            );
          });
      }

      return created(res, "Attendance marked in bulk", result);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to mark attendance in bulk";
      if (
        msg === "INVALID_DATE" ||
        msg === "MISSING_TEACHER_FOR_LESSON" ||
        msg === "GROUP_NOT_FOUND" ||
        msg === "SUBJECT_NOT_FOUND"
      ) {
        return fail(res, 400, msg);
      }

      logError("AdminAttendanceController", "bulkMarkByDate failed", {
        requestId: (req as any).requestId,
        body: req.body,
        user: (req as any).user,
        error: err,
      });
      return fail(res, 500, "Failed to mark attendance in bulk");
    }
  };
}
