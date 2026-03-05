export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamCallbacks = {
  onDelta: (delta: string) => void;
};

export class GroqChatService {
  private readonly apiUrl =
    process.env.GROQ_API_URL ??
    "https://api.groq.com/openai/v1/chat/completions";

  async streamChat(params: {
    model?: string;
    temperature?: number;
    messages: LlmMessage[];
    callbacks: StreamCallbacks;
    abortSignal?: AbortSignal;
  }): Promise<{ content: string }> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model ?? process.env.GROQ_MODEL ?? "qwen/qwen3-32b",
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
      signal: params.abortSignal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText} ${text}`.trim(),
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Groq");

    const decoder = new TextDecoder();

    let buffer = "";
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === "data: [DONE]") {
          buffer = "";
          break;
        }

        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6);
        try {
          const data = JSON.parse(jsonStr);
          const delta: string | undefined = data?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            fullContent += delta;
            params.callbacks.onDelta(delta);
          }
        } catch {
          // Ignore malformed/incomplete JSON lines
        }
      }
    }

    return { content: fullContent };
  }
}
