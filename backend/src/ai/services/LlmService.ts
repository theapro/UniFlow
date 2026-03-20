import type { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { OpenAiCompatibleClient } from "../../services/ai/OpenAiCompatibleClient";
import { AiModelService } from "../../services/ai/AiModelService";
import type { LlmMessage } from "../../services/ai/GroqChatService";

export class LlmService {
  private readonly client = new OpenAiCompatibleClient();
  private readonly models = new AiModelService();

  async chatJson(params: {
    role: UserRole;
    requestedModel?: string;
    temperature?: number;
    maxTokens?: number;
    messages: LlmMessage[];
  }): Promise<{ content: string }> {
    const resolved = await this.models.resolveChatModel({
      role: params.role,
      requestedModel: params.requestedModel,
    });

    const apiKey = process.env.GROQ_API_KEY ?? env.groqApiKey ?? "";
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

    const apiUrl =
      process.env.GROQ_API_URL ??
      env.groqApiUrl ??
      "https://api.groq.com/openai/v1/chat/completions";

    const result = await this.client.chat({
      apiUrl,
      apiKey,
      model: resolved.model,
      temperature: params.temperature ?? 0,
      maxTokens: params.maxTokens ?? 800,
      messages: params.messages,
    });

    return { content: result.content ?? "" };
  }
}
