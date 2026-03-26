import type { LlmMessage } from "../../services/ai/GroqChatService";
import type { AiBuiltContext, AiToolDecision } from "../types";
import type { AiToolDefinition } from "../tools/toolRegistry";
import type { AiToolName } from "../../services/ai-tools/toolNames";
import { LlmService } from "../services/LlmService";

function extractFirstJsonObject(text: string): any {
  const s = String(text ?? "");
  try {
    const direct = JSON.parse(s);
    if (direct && typeof direct === "object") return direct;
  } catch {
    // ignore
  }

  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) {
      const slice = s.slice(start, i + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export class AiClassifier {
  private readonly llm = new LlmService();

  private buildConversationHistoryMessages(params: {
    recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
    maxMessages: number;
  }): LlmMessage[] {
    const maxMessages = Math.min(Math.max(params.maxMessages, 0), 20);
    const recent = Array.isArray(params.recentMessages)
      ? params.recentMessages
      : [];

    const trimmed = recent
      .map((m) => ({
        role: m.role,
        content: String(m.content ?? "")
          .trim()
          .slice(0, 1_200),
      }))
      .filter((m) => m.content.length > 0);

    const slice = maxMessages > 0 ? trimmed.slice(-maxMessages) : [];
    return slice.map((m) => ({ role: m.role, content: m.content }));
  }

  private fallbackUnknown(lang: "en" | "ja" | "uz"): string {
    if (lang === "ja")
      return "すみません、うまく理解できませんでした。短く言い換えてください。";
    if (lang === "uz")
      return "Uzr, so‘rovni tushunmadim. Qisqaroq qilib qayta yozing.";
    return "Sorry, I didn't understand that. Could you rephrase briefly?";
  }

  async decide(params: {
    message: string;
    context: AiBuiltContext;
    tools: AiToolDefinition[];
    allowedToolNames: AiToolName[];
    requestedModel?: string;
    lang?: "en" | "ja" | "uz";
  }): Promise<AiToolDecision> {
    const lang = params.lang ?? "en";
    const toolsForPrompt = params.tools
      .filter((t) => params.allowedToolNames.includes(t.name))
      .map((t) => ({
        name: t.name,
        description: t.description,
        argsSchema: t.argsSchema,
      }));

    const system: LlmMessage = {
      role: "system",
      content:
        "You are UniFlow AI router. Decide the best response for the user message. " +
        "Tool-first policy: if the message is about university data (student/teacher/schedule/attendance/grades) and a relevant tool exists, choose type=tool. " +
        "Prefer the MOST SPECIFIC tool that matches the question. " +
        "For students: personal/profile info -> getStudentProfile; today's schedule -> getTodaySchedule (or legacy getStudentScheduleToday); weekly schedule -> getWeeklySchedule; monthly schedule -> getMonthlySchedule; attendance -> getStudentAttendanceRecent; grades -> getStudentGradesRecent. " +
        "Use getStudentDashboard ONLY when the user explicitly asks for a dashboard/summary (schedule + attendance + grades together). " +
        "If no relevant tool exists, choose type=llm and produce the final assistant response yourself. " +
        "Rules: output ONLY strict JSON (no markdown, no extra text). " +
        "Do not include hidden reasoning. " +
        "Conversation memory: previous messages are provided in the chat history; use them to resolve follow-ups (e.g., 'tomorrow', 'that one', pronouns) and keep continuity. " +
        `Never invent private data. User language: ${lang}. If you cannot answer safely, ask one short clarifying question in that language. ` +
        "When type=llm, write the response in the user's language. " +
        "\n\nJSON schema:\n" +
        JSON.stringify(
          {
            type: "tool",
            tool: "getStudentDashboard",
            args: {},
            confidence: 0.9,
            reason:
              "Tool selected because the user asked for today's schedule and it requires DB data",
            response: null,
          },
          null,
          2,
        ) +
        "\n\nWhen type=llm: tool must be null and response must be a non-empty string. Always set reason (1 short sentence).",
    };

    const history = this.buildConversationHistoryMessages({
      recentMessages: Array.isArray(params.context?.recentMessages)
        ? (params.context.recentMessages as any)
        : [],
      maxMessages: 12,
    });

    const user: LlmMessage = {
      role: "user",
      content: [
        `USER_MESSAGE:\n${params.message}`,
        `\nUSER_CONTEXT_JSON:\n${JSON.stringify(params.context)}`,
        `\nAVAILABLE_TOOLS_JSON:\n${JSON.stringify(toolsForPrompt)}`,
      ].join("\n"),
    };

    const out = await this.llm.chatJson({
      role: params.context.identity.role,
      requestedModel: params.requestedModel,
      temperature: 0,
      maxTokens: 700,
      messages: [system, ...history, user],
    });

    const parsed = extractFirstJsonObject(out.content);
    if (!parsed) {
      return {
        type: "llm",
        tool: null,
        args: null,
        confidence: 0,
        response: this.fallbackUnknown(lang),
      };
    }

    const type = parsed.type === "tool" ? "tool" : "llm";
    const tool = typeof parsed.tool === "string" ? parsed.tool : null;
    const args =
      parsed.args &&
      typeof parsed.args === "object" &&
      !Array.isArray(parsed.args)
        ? (parsed.args as Record<string, unknown>)
        : null;
    const confidence = clampConfidence(parsed.confidence);
    const reason = typeof parsed.reason === "string" ? parsed.reason : null;
    const response =
      typeof parsed.response === "string" ? parsed.response : null;

    if (type === "tool") {
      return {
        type,
        tool: tool,
        args: args ?? {},
        confidence,
        reason:
          reason && reason.trim().length > 0
            ? reason.trim().slice(0, 240)
            : null,
        response: null,
      };
    }

    return {
      type: "llm",
      tool: null,
      args: null,
      confidence,
      reason:
        reason && reason.trim().length > 0 ? reason.trim().slice(0, 240) : null,
      response:
        response && response.trim().length > 0
          ? response.trim().slice(0, 6_000)
          : this.fallbackUnknown(lang),
    };
  }
}
