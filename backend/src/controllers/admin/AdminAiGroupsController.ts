import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiGroupLayoutService } from "../../services/scheduling/AiGroupLayoutService";

export class AdminAiGroupsController {
  constructor(private readonly svc: AiGroupLayoutService) {}

  arrange = async (req: Request, res: Response) => {
    try {
      const { maxColumns } = req.body ?? {};
      const result = await this.svc.arrangeLayout({
        maxColumns:
          maxColumns !== undefined && Number.isFinite(Number(maxColumns))
            ? Number(maxColumns)
            : undefined,
      });

      return ok(res, "Groups layout arranged", result);
    } catch (err: any) {
      return fail(res, 500, err?.message ?? "Failed to arrange groups layout");
    }
  };
}
