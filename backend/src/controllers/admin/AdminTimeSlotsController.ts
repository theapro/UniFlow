import type { Request, Response } from "express";
import { AdminTimeSlotsService } from "../../services/admin/AdminTimeSlotsService";
import { fail, ok } from "../../utils/responses";

export class AdminTimeSlotsController {
  constructor(private readonly timeSlotsService: AdminTimeSlotsService) {}

  list = async (_req: Request, res: Response) => {
    try {
      const rows = await this.timeSlotsService.list();
      return ok(res, "Time slots fetched", rows);
    } catch {
      return fail(res, 500, "Failed to fetch time slots");
    }
  };
}
