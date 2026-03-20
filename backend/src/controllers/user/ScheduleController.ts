import type { Request, Response } from "express";
import { ScheduleService } from "../../services/user/ScheduleService";
import { fail, ok } from "../../utils/responses";
import { UserRole } from "@prisma/client";

export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  getSchedule = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return fail(res, 401, "Unauthorized");
      }

      const weekday =
        typeof req.query.weekday === "string" ? req.query.weekday : undefined;

      if (user.role === UserRole.STUDENT) {
        if (!user.studentId) {
          return fail(res, 400, "Student profile not linked");
        }

        const schedule = await this.scheduleService.getScheduleByStudentId(
          user.studentId,
          weekday,
        );
        return ok(res, "Schedule fetched", schedule);
      }

      if (user.role === UserRole.TEACHER) {
        if (!user.teacherId) {
          return fail(res, 400, "Teacher profile not linked");
        }

        const schedule = await this.scheduleService.getScheduleByTeacherId(
          user.teacherId,
          weekday,
        );
        return ok(res, "Schedule fetched", schedule);
      }

      return fail(res, 403, "Only students and teachers can view schedule");
    } catch {
      return fail(res, 500, "Failed to fetch schedule");
    }
  };
}
