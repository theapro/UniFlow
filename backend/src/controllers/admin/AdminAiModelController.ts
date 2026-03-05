import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiModelService } from "../../services/ai/AiModelService";

export class AdminAiModelController {
  constructor(private readonly aiModelService: AiModelService) {}

  list = async (_req: Request, res: Response) => {
    try {
      const models = await this.aiModelService.listAll();
      return ok(res, "OK", models);
    } catch (error) {
      console.error("AdminAiModelController.list failed:", error);
      return fail(res, 500, "Failed to list AI models");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id ?? "");
      if (!id) return fail(res, 400, "id is required");

      const patch = req.body ?? {};

      const updated = await this.aiModelService.updateModel(id, {
        ...(patch.displayName !== undefined
          ? { displayName: patch.displayName }
          : {}),
        ...(patch.isEnabled !== undefined
          ? { isEnabled: patch.isEnabled }
          : {}),
        ...(patch.enabledForUsers !== undefined
          ? { enabledForUsers: patch.enabledForUsers }
          : {}),
        ...(patch.enabledForAdmins !== undefined
          ? { enabledForAdmins: patch.enabledForAdmins }
          : {}),
        ...(patch.sortOrder !== undefined
          ? { sortOrder: patch.sortOrder }
          : {}),
      });

      return ok(res, "OK", updated);
    } catch (error) {
      console.error("AdminAiModelController.update failed:", error);
      return fail(res, 500, "Failed to update AI model");
    }
  };
}
