import type { Request, Response } from "express";
import { AttendanceService } from "../../services/user/AttendanceService";
import { created, fail, ok } from "../../utils/responses";
import { Role } from "@prisma/client";

export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  markAttendance = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (user?.role !== Role.TEACHER) {
        return fail(res, 403, "Only teachers can mark attendance");
      }

      const { lessonId, studentId, status } = req.body ?? {};

      if (!lessonId || !studentId || !status) {
        return fail(res, 400, "lessonId, studentId, status are required");
      }

      const record = await this.attendanceService.markAttendance(
        lessonId,
        studentId,
        status,
      );
      return created(res, "Attendance marked", record);
    } catch {
      return fail(res, 500, "Failed to mark attendance");
    }
  };

  getAttendanceByLesson = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (user?.role !== Role.TEACHER) {
        return fail(res, 403, "Only teachers can view lesson attendance");
      }

      const lessonId = req.params.lessonId;
      if (!lessonId) {
        return fail(res, 400, "lessonId is required");
      }

      const attendance =
        await this.attendanceService.getAttendanceByLesson(lessonId);
      return ok(res, "Attendance fetched", attendance);
    } catch {
      return fail(res, 500, "Failed to fetch attendance");
    }
  };
}
