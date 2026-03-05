import type { Request, Response } from "express";
import { AdminAttendanceService } from "../../services/admin/AdminAttendanceService";
import { created, fail, ok } from "../../utils/responses";

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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      return fail(res, 500, "Failed to update attendance record");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.attendanceService.remove(req.params.id);
      return ok(res, "Attendance record deleted");
    } catch {
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
    } catch {
      return fail(res, 500, "Failed to mark attendance in bulk");
    }
  };
}
