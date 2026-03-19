import { UserRole } from "@prisma/client";
import { env } from "../../config/env";
import { AiModelService } from "./AiModelService";
import { AiSettingsService } from "./AiSettingsService";
import { AiToolConfigService } from "./AiToolConfigService";
import { AiUsageLogService } from "./AiUsageLogService";
import { OpenAiCompatibleClient } from "./OpenAiCompatibleClient";
import { executeAiTool } from "../ai-tools/executeTool";
import type { AiToolName } from "../ai-tools/toolNames";
import { AiAccessError } from "../ai-tools/access";

type ProviderConfig = {
  provider: "groq" | "openai";
  apiUrl: string;
  apiKey: string;
};

function isMonthScheduleQuery(message: string): boolean {
  const s = String(message ?? "").toLowerCase();

  const mentionsSchedule =
    /(schedule|timetable|lesson|classes|raspisan|расписан)/.test(s) ||
    /(jadval|dars|dars jadval)/.test(s);

  const mentionsMonth =
    /(this month|current month|monthly)/.test(s) ||
    /(bu oy|shu oy|oygi|oylik|oyning)/.test(s);

  return mentionsSchedule && mentionsMonth;
}

function extractFirstJsonObject(text: string): any {
  const s = String(text ?? "");
  // Fast path: if the whole response is valid JSON.
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

function pickFallbackTool(params: {
  role: UserRole;
  message: string;
  allowedToolNames: string[];
}):
  | {
      tool: AiToolName;
      args: Record<string, unknown>;
      needsClarification: false;
      clarifyingQuestion: string;
    }
  | {
      tool: null;
      args: null;
      needsClarification: true;
      clarifyingQuestion: string;
    } {
  const s = String(params.message ?? "")
    .trim()
    .toLowerCase();
  const allowed = new Set(params.allowedToolNames);

  if (
    allowed.has("getStudentMonthlySchedule") &&
    (params.role === UserRole.STUDENT || params.role === UserRole.TEACHER) &&
    isMonthScheduleQuery(params.message)
  ) {
    return {
      tool: "getStudentMonthlySchedule",
      args: {},
      needsClarification: false,
      clarifyingQuestion: "",
    };
  }

  const preferFull =
    /(teacher|my teacher|who.*teacher|attendance|absent|present|grades?|score|mark|schedule|timetable|lesson|classes|group|subject)/.test(
      s,
    ) ||
    /(o['’]qituvch|ustoz|davomat|kelmagan|keldi|bahol|baho|ball|reyting|dars|dars jadval|jadval|guruh|fan)/.test(
      s,
    ) ||
    /(учител|преподавател|оценк|успеваем|расписан|посещаем|групп|предмет)/.test(
      s,
    );

  if (
    preferFull &&
    allowed.has("getStudentFullContext") &&
    (params.role === UserRole.STUDENT || params.role === UserRole.TEACHER)
  ) {
    return {
      tool: "getStudentFullContext",
      args: {},
      needsClarification: false,
      clarifyingQuestion: "",
    };
  }

  if (allowed.has("getStudentProfile") && params.role === UserRole.STUDENT) {
    return {
      tool: "getStudentProfile",
      args: {},
      needsClarification: false,
      clarifyingQuestion: "",
    };
  }

  return {
    tool: null,
    args: null,
    needsClarification: true,
    clarifyingQuestion:
      "Aniqroq ayting: qaysi guruh yoki qaysi student haqida so‘rayapsiz?",
  };
}

function getProviderConfig(provider: string): ProviderConfig {
  const p = (provider ?? "").toLowerCase();

  if (p === "openai") {
    const apiKey = process.env.OPENAI_API_KEY ?? "";
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return {
      provider: "openai",
      apiUrl:
        process.env.OPENAI_API_URL ??
        "https://api.openai.com/v1/chat/completions",
      apiKey,
    };
  }

  // default: groq (OpenAI-compatible)
  const apiKey = process.env.GROQ_API_KEY ?? env.groqApiKey ?? "";
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  return {
    provider: "groq",
    apiUrl:
      process.env.GROQ_API_URL ??
      env.groqApiUrl ??
      "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
  };
}

export class AiAssistantService {
  private readonly settingsService = new AiSettingsService();
  private readonly toolConfigService = new AiToolConfigService();
  private readonly modelService = new AiModelService();
  private readonly llm = new OpenAiCompatibleClient();
  private readonly logs = new AiUsageLogService();

  private shouldPreferStudentFullContext(message: string): boolean {
    const s = message.trim().toLowerCase();

    // Month-specific schedule requests are better served by the calendar schedule tool.
    if (isMonthScheduleQuery(s)) return false;

    // English
    if (
      /(teacher|my teacher|who.*teacher|attendance|absent|present|grades?|score|mark|schedule|timetable|lesson days|group|subject)/.test(
        s,
      )
    ) {
      return true;
    }
    // Uzbek (common terms)
    if (
      /(o['’]qituvch|ustoz|davomat|kelmagan|keldi|bahol|baho|ball|reyting|dars jadval|jadval|dars kun|guruh|fan)/.test(
        s,
      )
    ) {
      return true;
    }
    // Russian (basic)
    if (
      /(учител|преподавател|оценк|успеваем|расписан|посещаем|групп|предмет)/.test(
        s,
      )
    ) {
      return true;
    }
    return false;
  }

  async chat(params: {
    user: Express.User;
    requestId: string | null;
    message: string;
    requestedModel?: string;
  }): Promise<{ reply: string; toolUsed: AiToolName | null }> {
    const startedAt = Date.now();

    const settings = await this.settingsService.getOrCreate();
    if (!settings.isEnabled) {
      return {
        reply: "AI system is currently disabled by admin.",
        toolUsed: null,
      };
    }

    // Pick a model (provider+model are stored in AiModel)
    const role = params.user.role;

    const allowedModels = await this.modelService.listAllowedForRole({ role });

    const defaultModelId =
      role === UserRole.ADMIN
        ? settings.defaultAdminChatModelId
        : settings.defaultUserChatModelId;

    const requestedModel = params.requestedModel?.trim();

    const requested = requestedModel
      ? allowedModels.find((m) => m.model === requestedModel)
      : null;

    const chosen =
      requested ??
      (defaultModelId
        ? allowedModels.find((m) => m.id === defaultModelId)
        : null) ??
      allowedModels[0] ??
      null;

    const provider = chosen?.provider ?? "groq";
    const model =
      chosen?.model ??
      env.groqModel ??
      process.env.GROQ_MODEL ??
      "qwen/qwen3-32b";

    const providerCfg = getProviderConfig(provider);

    const logRow = await this.logs.logStart({
      userId: params.user.id ?? null,
      role: params.user.role ?? null,
      requestId: params.requestId,
      provider,
      model,
      userMessage: params.message,
      meta: { kind: "assistant" },
    });

    let toolUsed: AiToolName | null = null;
    try {
      const allowedTools = await this.toolConfigService.listAllowed(role);
      const allowedToolNames = allowedTools.map((t) => t.name);

      const userIdentity = {
        role: params.user.role,
        userId: params.user.id,
        studentId: params.user.studentId,
        teacherId: params.user.teacherId,
        fullName: params.user.fullName ?? null,
        email: params.user.email,
      };

      const plannerMessages = [
        {
          role: "system" as const,
          content:
            settings.toolPlannerPrompt +
            "\n\n" +
            "Allowed tools: " +
            JSON.stringify(allowedToolNames) +
            "\n\n" +
            "Return JSON in this shape:\n" +
            JSON.stringify(
              {
                tool: "getStudentFullContext",
                args: { studentId: "..." },
                needsClarification: false,
                clarifyingQuestion: "",
              },
              null,
              2,
            ) +
            "\n\nRules:\n" +
            "- Choose exactly one tool when possible\n" +
            "- If user asks for THIS MONTH (bu oy/oylik) schedule, prefer getStudentMonthlySchedule\n" +
            "- If user asks about teacher(s), attendance, grades, schedule/timetable, group, or subjects, prefer getStudentFullContext\n" +
            "- If required identifiers are missing, set needsClarification=true and ask a single short question\n" +
            "- Do not invent studentId/groupId; if unknown ask for it\n" +
            "- For STUDENT role, omit studentId args for getStudent* tools when asking about their own data\n" +
            "- Students: never request other students' data\n" +
            "- Teachers: only request groups/students they teach\n" +
            "- Admins: can request system-wide tools\n" +
            "- Output ONLY JSON, no markdown",
        },
        {
          role: "user" as const,
          content: `USER_IDENTITY:\n${JSON.stringify(userIdentity)}\n\nUSER_MESSAGE:\n${params.message}`,
        },
      ];

      const plan = await this.llm.chat({
        apiUrl: providerCfg.apiUrl,
        apiKey: providerCfg.apiKey,
        model,
        temperature: 0.0,
        maxTokens: 250,
        messages: plannerMessages,
      });

      let planJson = extractFirstJsonObject(plan.content);
      let plannerFallbackUsed = false;
      if (!planJson) {
        // Fallback: do not hard-fail if the planner model doesn't comply.
        planJson = pickFallbackTool({
          role,
          message: params.message,
          allowedToolNames,
        });
        plannerFallbackUsed = true;
      }

      const needsClarification = Boolean(planJson.needsClarification);
      const clarifyingQuestion =
        typeof planJson.clarifyingQuestion === "string"
          ? planJson.clarifyingQuestion.trim()
          : "";

      if (needsClarification) {
        const reply =
          clarifyingQuestion ||
          "I need a bit more information. Can you clarify?";
        await this.logs.logFinish({
          id: logRow.id,
          toolName: null,
          toolArgs: null,
          assistantMessage: reply,
          status: "OK",
          error: null,
          ms: Date.now() - startedAt,
          meta: { clarified: true },
        });
        return { reply, toolUsed: null };
      }

      let tool = String(planJson.tool ?? "") as AiToolName;

      if (!allowedToolNames.includes(tool)) {
        const fallback = pickFallbackTool({
          role,
          message: params.message,
          allowedToolNames,
        });
        if (fallback.needsClarification) {
          const reply =
            fallback.clarifyingQuestion ||
            "I need a bit more information. Can you clarify?";
          await this.logs.logFinish({
            id: logRow.id,
            toolName: null,
            toolArgs: null,
            assistantMessage: reply,
            status: "OK",
            error: null,
            ms: Date.now() - startedAt,
            meta: { clarified: true, plannerFallbackUsed: true },
          });
          return { reply, toolUsed: null };
        }
        tool = fallback.tool;
        plannerFallbackUsed = true;
      }

      const args =
        typeof planJson.args === "object" && planJson.args ? planJson.args : {};

      // Deterministic override: month schedule queries should use the calendar-based tool.
      if (
        allowedToolNames.includes("getStudentMonthlySchedule") &&
        tool.startsWith("getStudent") &&
        isMonthScheduleQuery(params.message)
      ) {
        tool = "getStudentMonthlySchedule";
      }

      // Deterministic override: for relational student questions, prefer full context.
      if (
        allowedToolNames.includes("getStudentFullContext") &&
        tool.startsWith("getStudent") &&
        this.shouldPreferStudentFullContext(params.message)
      ) {
        tool = "getStudentFullContext";
      }

      toolUsed = tool;

      // Execute tool (RBAC enforced inside executeAiTool as well)
      const toolResult = await executeAiTool(
        { user: params.user },
        { tool, args },
      );

      // Final response formatting via LLM (no sensitive data beyond toolResult)
      const finalMessages = [
        {
          role: "system" as const,
          content:
            settings.systemPrompt +
            "\n\nFormatting rules:\n" +
            "- Be concise and human-readable\n" +
            "- Use the user's language; default Uzbek\n" +
            "- If toolResult is null (not found), say it clearly\n" +
            "- If toolResult contains the needed info, answer directly; do NOT say 'I don't know'\n" +
            "- Do not mention internal tools or JSON\n" +
            "- Do not leak IDs unless user asked",
        },
        {
          role: "user" as const,
          content: `USER_ROLE:${role}\nUSER_MESSAGE:${params.message}\n\nTOOL_USED:${tool}\nTOOL_RESULT_JSON:\n${JSON.stringify(toolResult)}`,
        },
      ];

      const final = await this.llm.chat({
        apiUrl: providerCfg.apiUrl,
        apiKey: providerCfg.apiKey,
        model,
        temperature: 0.4,
        maxTokens: 800,
        messages: finalMessages,
      });

      const reply = (final.content ?? "").trim() || "OK";

      await this.logs.logFinish({
        id: logRow.id,
        toolName: tool,
        toolArgs: args,
        assistantMessage: reply,
        status: "OK",
        error: null,
        ms: Date.now() - startedAt,
        meta: { provider: providerCfg.provider, plannerFallbackUsed },
      });

      return { reply, toolUsed: tool };
    } catch (error: any) {
      const msg =
        typeof error?.message === "string" ? error.message : "AI_ERROR";
      await this.logs.logFinish({
        id: logRow.id,
        toolName: toolUsed,
        toolArgs: null,
        assistantMessage: null,
        status: "ERROR",
        error: msg,
        ms: Date.now() - startedAt,
      });

      // Keep error message non-sensitive
      if (msg === "TOOL_NOT_ALLOWED") {
        return {
          reply: "Sorry, I can’t help with that request.",
          toolUsed: null,
        };
      }

      if (error instanceof AiAccessError) {
        if (error.code === "FORBIDDEN") {
          return {
            reply: "Sorry, you don’t have permission to access that data.",
            toolUsed: null,
          };
        }
        if (error.code === "BAD_REQUEST") {
          return {
            reply:
              "I need a bit more information to help. Please clarify your request.",
            toolUsed: null,
          };
        }
        if (error.code === "NOT_FOUND") {
          return { reply: "I couldn’t find that record.", toolUsed: null };
        }
      }

      return { reply: "AI request failed. Please try again.", toolUsed: null };
    }
  }
}
