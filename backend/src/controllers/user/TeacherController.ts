import type { Request, Response } from "express";
import { TeacherService } from "../../services/user/TeacherService";
import { fail, ok } from "../../utils/responses";

export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  getTodayLessons = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user?.teacherId) {
        return fail(res, 403, "Only teachers can access this resource");
      }

      const lessons = await this.teacherService.getTodayLessons(user.teacherId);
      return ok(res, "Today lessons fetched", lessons);
    } catch {
      return fail(res, 500, "Failed to fetch today lessons");
    }
  };

  getGroupSchedule = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user?.teacherId) {
        return fail(res, 403, "Only teachers can access this resource");
      }

      const groupId = req.params.groupId;
      if (!groupId) {
        return fail(res, 400, "groupId is required");
      }

      const schedule = await this.teacherService.getGroupSchedule(
        user.teacherId,
        groupId,
      );
      return ok(res, "Group schedule fetched", schedule);
    } catch {
      return fail(res, 500, "Failed to fetch group schedule");
    }
  };
}
