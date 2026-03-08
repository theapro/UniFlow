import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
import { AiAssistantService } from "../../services/ai/AiAssistantService";

export class AiAssistantController {
  private readonly service = new AiAssistantService();

  chat = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const message = (req.body?.message ?? "") as unknown;
      if (typeof message !== "string" || message.trim().length === 0) {
        return fail(res, 400, "message is required");
      }

      const requestId = ((req as any).requestId ?? null) as string | null;

      const result = await this.service.chat({
        user,
        requestId,
        message: message.trim().slice(0, 4_000),
      });

      return ok(res, "OK", {
        reply: result.reply,
        toolUsed: result.toolUsed,
      });
    } catch (error: any) {
      console.error("AiAssistantController.chat failed:", error);
      return fail(res, 500, "AI request failed");
    }
  };
}
