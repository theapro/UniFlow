import { env } from "../../config/env";
import { OpenAiCompatibleClient } from "../ai/OpenAiCompatibleClient";
import type { LlmMessage } from "../ai/GroqChatService";

export type ReceptionistLlmProvider = "groq" | "openai";

function pickFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

export class ReceptionistLlmService {
  private readonly client = new OpenAiCompatibleClient();

  async chat(params: {
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
    requestedModel?: string;
    abortSignal?: AbortSignal;
  }): Promise<{
    content: string;
    provider: ReceptionistLlmProvider;
    model: string;
  }> {
    const groqApiKey = pickFirstNonEmpty(
      process.env.GROQ_API_KEY,
      env.groqApiKey,
    );
    const openaiApiKey = pickFirstNonEmpty(
      process.env.OPENAI_API_KEY,
      env.openaiApiKey,
    );

    const provider: ReceptionistLlmProvider = groqApiKey
      ? "groq"
      : openaiApiKey
        ? "openai"
        : "groq";

    const apiKey =
      provider === "groq"
        ? groqApiKey
        : provider === "openai"
          ? openaiApiKey
          : "";

    if (!apiKey) {
      throw new Error(
        "LLM is not configured (set GROQ_API_KEY or OPENAI_API_KEY)",
      );
    }

    const apiUrl =
      provider === "groq"
        ? pickFirstNonEmpty(
            process.env.GROQ_API_URL,
            env.groqApiUrl,
            "https://api.groq.com/openai/v1/chat/completions",
          )
        : pickFirstNonEmpty(
            process.env.OPENAI_API_URL,
            env.openaiApiUrl,
            "https://api.openai.com/v1/chat/completions",
          );

    const model =
      pickFirstNonEmpty(
        params.requestedModel,
        provider === "groq" ? process.env.GROQ_MODEL : process.env.OPENAI_MODEL,
        provider === "groq" ? env.groqModel : undefined,
        provider === "groq" ? "qwen/qwen3-32b" : "gpt-4o-mini",
      ) || (provider === "groq" ? "qwen/qwen3-32b" : "gpt-4o-mini");

    const result = await this.client.chat({
      apiUrl,
      apiKey,
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      maxTokens: params.maxTokens ?? 900,
    });

    return { content: result.content ?? "", provider, model };
  }
}
