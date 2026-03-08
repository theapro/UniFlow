import type { LlmMessage } from "./GroqChatService";

export type OpenAiChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function extractContent(json: any): string {
  const c = json?.choices?.[0]?.message?.content;
  return typeof c === "string" ? c : "";
}

export class OpenAiCompatibleClient {
  async chat(params: {
    apiUrl: string;
    apiKey: string;
    model: string;
    messages: LlmMessage[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string; raw: any }> {
    const res = await fetch(params.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.2,
        ...(typeof params.maxTokens === "number" &&
        Number.isFinite(params.maxTokens)
          ? {
              max_tokens: Math.min(
                Math.max(Math.floor(params.maxTokens), 1),
                8192,
              ),
            }
          : {}),
        stream: false,
      }),
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(
        `LLM_API_ERROR:${res.status}:${res.statusText}:${text}`.slice(0, 4_000),
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const content = extractContent(json);
    return { content, raw: json };
  }
}
