import type { Request, Response } from "express";
import { AdminMonthlyScheduleService } from "../../services/admin/AdminMonthlyScheduleService";
import { created, fail, ok } from "../../utils/responses";

export class AdminMonthlyScheduleController {
  constructor(private readonly scheduleService: AdminMonthlyScheduleService) {}

  listMonths = async (_req: Request, res: Response) => {
    try {
      const rows = await this.scheduleService.listMonths();
      return ok(res, "Monthly schedule months fetched", rows);
    } catch {
      return fail(res, 500, "Failed to fetch monthly schedule months");
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const month =
        typeof req.query.month === "string" ? Number(req.query.month) : NaN;
      const year =
        typeof req.query.year === "string" ? Number(req.query.year) : NaN;

      if (!Number.isFinite(month) || !Number.isFinite(year)) {
        return fail(res, 400, "month and year are required");
      }
      if (month < 1 || month > 12) {
        return fail(res, 400, "month must be 1..12");
      }
      if (year < 2000 || year > 2100) {
        return fail(res, 400, "year must be 2000..2100");
      }

      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : undefined;
      const teacherId =
        typeof req.query.teacherId === "string"
          ? req.query.teacherId
          : undefined;

      const rows = await this.scheduleService.list({
        month,
        year,
        groupId,
        teacherId,
      });
      return ok(res, "Monthly schedule fetched", rows);
    } catch {
      return fail(res, 500, "Failed to fetch monthly schedule");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { date, timeSlotId, groupId, teacherId, subjectId, roomId, note } =
        req.body ?? {};

      if (!date || !timeSlotId || !groupId || !teacherId || !subjectId) {
        return fail(
          res,
          400,
          "date, timeSlotId, groupId, teacherId, subjectId are required",
        );
      }

      const result = await this.scheduleService.create({
        date: String(date),
        timeSlotId: String(timeSlotId),
        groupId: String(groupId),
        teacherId: String(teacherId),
        subjectId: String(subjectId),
        roomId: roomId ? String(roomId) : null,
        note: note ? String(note) : null,
      });

      if (!result.ok) {
        return fail(res, result.status, result.message);
      }

      return created(res, "Schedule created", result.data);
    } catch {
      return fail(res, 500, "Failed to create schedule");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { date, timeSlotId, groupId, teacherId, subjectId, roomId, note } =
        req.body ?? {};

      const result = await this.scheduleService.update(req.params.id, {
        ...(date !== undefined ? { date: String(date) } : {}),
        ...(timeSlotId !== undefined ? { timeSlotId: String(timeSlotId) } : {}),
        ...(groupId !== undefined ? { groupId: String(groupId) } : {}),
        ...(teacherId !== undefined ? { teacherId: String(teacherId) } : {}),
        ...(subjectId !== undefined ? { subjectId: String(subjectId) } : {}),
        ...(roomId !== undefined
          ? { roomId: roomId ? String(roomId) : null }
          : {}),
        ...(note !== undefined ? { note: note ? String(note) : null } : {}),
      });

      if (!result.ok) {
        return fail(res, result.status, result.message);
      }

      return ok(res, "Schedule updated", result.data);
    } catch {
      return fail(res, 500, "Failed to update schedule");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const result = await this.scheduleService.remove(req.params.id);
      if (!result.ok) {
        return fail(res, result.status, result.message);
      }
      return ok(res, "Schedule deleted");
    } catch {
      return fail(res, 500, "Failed to delete schedule");
    }
  };
}
