import type { Request, Response } from "express";
import { AdminScheduleService } from "../../services/admin/AdminScheduleService";
import { created, fail, ok } from "../../utils/responses";

export class AdminScheduleController {
  constructor(private readonly scheduleService: AdminScheduleService) {}

  list = async (req: Request, res: Response) => {
    try {
      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : undefined;
      const teacherId =
        typeof req.query.teacherId === "string"
          ? req.query.teacherId
          : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const entries = await this.scheduleService.list({
        groupId,
        teacherId,
        take,
        skip,
      });
      return ok(res, "Schedule entries fetched", entries);
    } catch {
      return fail(res, 500, "Failed to fetch schedule entries");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const entry = await this.scheduleService.getById(req.params.id);
      if (!entry) {
        return fail(res, 404, "Schedule entry not found");
      }
      return ok(res, "Schedule entry fetched", entry);
    } catch {
      return fail(res, 500, "Failed to fetch schedule entry");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const {
        weekday,
        groupId,
        teacherId,
        subjectId,
        timeSlotId,
        roomId,
        effectiveFrom,
        effectiveTo,
      } = req.body ?? {};

      if (!weekday || !groupId || !teacherId || !subjectId || !timeSlotId) {
        return fail(
          res,
          400,
          "weekday, groupId, teacherId, subjectId, timeSlotId are required",
        );
      }

      const entry = await this.scheduleService.create({
        weekday,
        groupId,
        teacherId,
        subjectId,
        timeSlotId,
        roomId: roomId ?? null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      });

      return created(res, "Schedule entry created", entry);
    } catch {
      return fail(res, 500, "Failed to create schedule entry");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const {
        weekday,
        groupId,
        teacherId,
        subjectId,
        timeSlotId,
        roomId,
        effectiveFrom,
        effectiveTo,
      } = req.body ?? {};

      const entry = await this.scheduleService.update(req.params.id, {
        ...(weekday !== undefined ? { weekday } : {}),
        ...(groupId !== undefined ? { groupId } : {}),
        ...(teacherId !== undefined ? { teacherId } : {}),
        ...(subjectId !== undefined ? { subjectId } : {}),
        ...(timeSlotId !== undefined ? { timeSlotId } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
        ...(effectiveFrom !== undefined
          ? { effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null }
          : {}),
        ...(effectiveTo !== undefined
          ? { effectiveTo: effectiveTo ? new Date(effectiveTo) : null }
          : {}),
      });

      return ok(res, "Schedule entry updated", entry);
    } catch {
      return fail(res, 500, "Failed to update schedule entry");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.scheduleService.remove(req.params.id);
      return ok(res, "Schedule entry deleted");
    } catch {
      return fail(res, 500, "Failed to delete schedule entry");
    }
  };
}
