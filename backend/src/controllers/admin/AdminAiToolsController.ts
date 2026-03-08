import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiToolConfigService } from "../../services/ai/AiToolConfigService";

export class AdminAiToolsController {
  constructor(private readonly svc: AiToolConfigService) {}

  list = async (_req: Request, res: Response) => {
    try {
      const items = await this.svc.listAll();
      return ok(res, "OK", { items });
    } catch (error) {
      console.error("AdminAiToolsController.list failed:", error);
      return fail(res, 500, "Failed to list AI tools");
    }
  };

  patch = async (req: Request, res: Response) => {
    try {
      const name = String(req.params.name ?? "");
      if (!name) return fail(res, 400, "name is required");

      const patch = req.body ?? {};
      const updated = await this.svc.update(name, {
        ...(patch.isEnabled !== undefined
          ? { isEnabled: Boolean(patch.isEnabled) }
          : {}),
        ...(patch.enabledForStudents !== undefined
          ? { enabledForStudents: Boolean(patch.enabledForStudents) }
          : {}),
        ...(patch.enabledForTeachers !== undefined
          ? { enabledForTeachers: Boolean(patch.enabledForTeachers) }
          : {}),
        ...(patch.enabledForAdmins !== undefined
          ? { enabledForAdmins: Boolean(patch.enabledForAdmins) }
          : {}),
      });

      return ok(res, "OK", updated);
    } catch (error: any) {
      const msg = typeof error?.message === "string" ? error.message : "Failed";
      if (msg === "UNKNOWN_TOOL") return fail(res, 400, "Unknown tool");
      console.error("AdminAiToolsController.patch failed:", error);
      return fail(res, 500, "Failed to update AI tool");
    }
  };
}
