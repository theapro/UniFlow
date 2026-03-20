import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";

export class AdminAiDebugController {
  constructor(private readonly svc: AiUsageLogService) {}

  list = async (req: Request, res: Response) => {
    try {
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const cursor =
        typeof req.query.cursor === "string" ? req.query.cursor : null;

      const result = await this.svc.listDebugTraces({ take, cursor });

      // Return all recent AI usage logs; UI can still render richer info when
      // meta.debugTrace exists.
      return ok(res, "OK", {
        items: result.items,
        nextCursor: result.nextCursor,
      });
    } catch (error) {
      console.error("AdminAiDebugController.list failed:", error);
      return fail(res, 500, "Failed to list AI debug traces");
    }
  };
}
