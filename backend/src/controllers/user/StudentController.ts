import type { Request, Response } from "express";
import { StudentService } from "../../services/user/StudentService";
import { fail, ok } from "../../utils/responses";

export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  getTodaySchedule = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user?.studentId) {
        return fail(res, 403, "Only students can access this resource");
      }

      const schedule = await this.studentService.getTodaySchedule(
        user.studentId,
      );
      return ok(res, "Today schedule fetched", schedule);
    } catch {
      return fail(res, 500, "Failed to fetch schedule");
    }
  };

  getAttendance = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user?.studentId) {
        return fail(res, 403, "Only students can access this resource");
      }

      const attendance = await this.studentService.getAttendance(
        user.studentId,
      );
      return ok(res, "Attendance fetched", attendance);
    } catch {
      return fail(res, 500, "Failed to fetch attendance");
    }
  };
}
