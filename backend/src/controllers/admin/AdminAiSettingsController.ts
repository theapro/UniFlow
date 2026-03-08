import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiSettingsService } from "../../services/ai/AiSettingsService";

export class AdminAiSettingsController {
  constructor(private readonly svc: AiSettingsService) {}

  get = async (_req: Request, res: Response) => {
    try {
      const settings = await this.svc.getOrCreate();
      return ok(res, "OK", settings);
    } catch (error) {
      console.error("AdminAiSettingsController.get failed:", error);
      return fail(res, 500, "Failed to fetch AI settings");
    }
  };

  patch = async (req: Request, res: Response) => {
    try {
      const patch = req.body ?? {};

      const updated = await this.svc.patch({
        ...(patch.isEnabled !== undefined
          ? { isEnabled: Boolean(patch.isEnabled) }
          : {}),
        ...(patch.systemPrompt !== undefined
          ? { systemPrompt: String(patch.systemPrompt) }
          : {}),
        ...(patch.toolPlannerPrompt !== undefined
          ? { toolPlannerPrompt: String(patch.toolPlannerPrompt) }
          : {}),
        ...(patch.defaultUserChatModelId !== undefined
          ? { defaultUserChatModelId: patch.defaultUserChatModelId }
          : {}),
        ...(patch.defaultAdminChatModelId !== undefined
          ? { defaultAdminChatModelId: patch.defaultAdminChatModelId }
          : {}),
      });

      return ok(res, "OK", updated);
    } catch (error) {
      console.error("AdminAiSettingsController.patch failed:", error);
      return fail(res, 500, "Failed to update AI settings");
    }
  };
}
