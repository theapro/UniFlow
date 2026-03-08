import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";

export class AdminAiLogsController {
  constructor(private readonly svc: AiUsageLogService) {}

  list = async (req: Request, res: Response) => {
    try {
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : null;

      const result = await this.svc.list({
        take,
        cursor,
      });

      return ok(res, "OK", result);
    } catch (error) {
      console.error("AdminAiLogsController.list failed:", error);
      return fail(res, 500, "Failed to list AI logs");
    }
  };
}
