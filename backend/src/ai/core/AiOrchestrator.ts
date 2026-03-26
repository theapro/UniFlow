import type { Request, Response } from "express";
import { ChatSender } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { fail } from "../../utils/responses";
import { ChatService } from "../../services/chat/ChatService";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";
import { AiSettingsService } from "../../services/ai/AiSettingsService";
import { AiToolConfigService } from "../../services/ai/AiToolConfigService";
import { buildContext } from "../context/buildContext";
import { AiClassifier } from "./AiClassifier";
import { AiResponder } from "./AiResponder";
import { executeTool } from "../tools/executeTool";
import { listToolDefinitions } from "../tools/toolRegistry";
import type { AiToolName } from "../../services/ai-tools/toolNames";
import { LlmService } from "../services/LlmService";
import {
  createAiDebugRuntime,
  finalizeAiDebugTrace,
  runWithAiDebugRuntime,
  type AiDebugRuntime,
} from "../../services/ai-debug/aiDebugTrace";

type DetectedLang = "en" | "ja" | "uz";
type DetectedIntent =
  | "tool:schedule"
  | "tool:attendance"
  | "tool:grades"
  | "llm";

type ScheduleScope = "today" | "tomorrow" | "week" | "month" | null;

function normalizeForIntent(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnorableMessage(input: string): boolean {
  const s = normalizeForIntent(input);
  if (!s) return true;

  // Only punctuation / filler / noise
  const noPunct = s
    .replace(/[.\-_,!?:;"'`~()\[\]{}<>\\/|@#$%^&*=+]/g, "")
    .trim();
  if (!noPunct) return true;

  const noise = new Set([
    ".",
    "..",
    "...",
    "000",
    "00",
    "0",
    "uh",
    "um",
    "ah",
    "er",
  ]);
  if (noise.has(s)) return true;

  // Repeated same char (e.g. "....", "0000")
  if (/^(\.|0)+$/.test(s)) return true;

  return false;
}

function detectLanguage(input: string): DetectedLang {
  const s = String(input ?? "");

  // Japanese scripts
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(s)) return "ja";

  // Uzbek Cyrillic-specific letters (and general Cyrillic as fallback)
  if (/[ЎўҚқҒғҲҳ]/.test(s)) return "uz";
  if (/[\u0400-\u04FF]/.test(s)) return "uz";

  // Uzbek Latin hints
  const lower = s.toLowerCase();
  if (
    /(\bo['’]zbek\b|\bjadval\b|\bdavomat\b|\bbaho\b|\bbaholar\b|\bdars\b)/.test(
      lower,
    )
  ) {
    return "uz";
  }
  if (/[ʻʼ’]/.test(s) && /(o|g)/i.test(s)) return "uz";

  return "en";
}

function detectIntent(input: string, lang: DetectedLang): DetectedIntent {
  const s = normalizeForIntent(input);
  if (!s) return "llm";

  // English
  const enSchedule =
    /\b(schedule|timetable|class(es)? today|today'?s classes)\b/i;
  const enAttendance = /\b(attendance|absen(t|ce)|present|late)\b/i;
  const enGrades = /\b(grades?|marks?|score|results?)\b/i;

  // Uzbek
  const uzSchedule = /\b(jadval|dars(lar)?|raspisaniye)\b/i;
  const uzAttendance = /\b(davomat)\b/i;
  const uzGrades = /\b(baho(lar)?|ball(lar)?)\b/i;

  // Japanese
  const jaSchedule = /(スケジュール|予定|時間割)/;
  const jaAttendance = /(出席|欠席|遅刻)/;
  const jaGrades = /(成績|点数|評価)/;

  const isSchedule =
    (lang === "en" && enSchedule.test(s)) ||
    (lang === "uz" && uzSchedule.test(s)) ||
    (lang === "ja" && jaSchedule.test(s));
  const isAttendance =
    (lang === "en" && enAttendance.test(s)) ||
    (lang === "uz" && uzAttendance.test(s)) ||
    (lang === "ja" && jaAttendance.test(s));
  const isGrades =
    (lang === "en" && enGrades.test(s)) ||
    (lang === "uz" && uzGrades.test(s)) ||
    (lang === "ja" && jaGrades.test(s));

  if (isSchedule) return "tool:schedule";
  if (isAttendance) return "tool:attendance";
  if (isGrades) return "tool:grades";
  return "llm";
}

function detectScheduleScope(input: string, lang: DetectedLang): ScheduleScope {
  const s = normalizeForIntent(input);
  if (!s) return null;

  // English
  const enTomorrow = /\b(tomorrow|next day)\b/i;
  const enToday = /\b(today|today's)\b/i;
  const enWeek = /\b(this week|weekly|week)\b/i;
  const enMonth = /\b(this month|monthly|month)\b/i;

  // Uzbek
  const uzTomorrow = /\b(ertaga)\b/i;
  const uzToday = /\b(bugun|bugungi)\b/i;
  const uzWeek = /\b(hafta|haftalik)\b/i;
  const uzMonth = /\b(oy|oylik)\b/i;

  // Japanese
  const jaTomorrow = /(明日)/;
  const jaToday = /(今日)/;
  const jaWeek = /(今週|週間)/;
  const jaMonth = /(今月|月間)/;

  const isTomorrow =
    (lang === "en" && enTomorrow.test(s)) ||
    (lang === "uz" && uzTomorrow.test(s)) ||
    (lang === "ja" && jaTomorrow.test(s));
  const isToday =
    (lang === "en" && enToday.test(s)) ||
    (lang === "uz" && uzToday.test(s)) ||
    (lang === "ja" && jaToday.test(s));
  const isWeek =
    (lang === "en" && enWeek.test(s)) ||
    (lang === "uz" && uzWeek.test(s)) ||
    (lang === "ja" && jaWeek.test(s));
  const isMonth =
    (lang === "en" && enMonth.test(s)) ||
    (lang === "uz" && uzMonth.test(s)) ||
    (lang === "ja" && jaMonth.test(s));

  if (isTomorrow) return "tomorrow";
  if (isWeek) return "week";
  if (isMonth) return "month";
  if (isToday) return "today";
  return null;
}

function inferPreviousTopicFromHistory(params: {
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  lang: DetectedLang;
}): DetectedIntent {
  const recent = Array.isArray(params.recentMessages)
    ? params.recentMessages
    : [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m.role !== "user") continue;
    const t = detectIntent(m.content, params.lang);
    if (t !== "llm") return t;
  }
  return "llm";
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeForSimilarity(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const na = normalizeForSimilarity(a);
  const nb = normalizeForSimilarity(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const toksA = new Set(na.split(" ").filter((w) => w.length >= 3));
  const toksB = new Set(nb.split(" ").filter((w) => w.length >= 3));
  if (toksA.size === 0 || toksB.size === 0) return 0;

  let inter = 0;
  for (const w of toksA) if (toksB.has(w)) inter++;
  const union = toksA.size + toksB.size - inter;
  return union <= 0 ? 0 : inter / union;
}

function nonRepeatingFallback(lang: DetectedLang): string {
  if (lang === "ja") {
    return "すみません、同じ返答になってしまいました。もう少し詳しく教えてください。";
  }
  if (lang === "uz") {
    return "Uzr, bir xil javob qaytarilib qoldi. Iltimos, biroz batafsil yozing.";
  }
  return "Sorry — I’m repeating myself. Could you add a bit more detail?";
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function writeSse(res: Response, payload: any) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeSseDone(res: Response) {
  res.write("data: [DONE]\n\n");
}

function streamText(
  res: Response,
  params: { sessionId: string; text: string },
) {
  const chunkSize = 140;
  const text = params.text ?? "";
  for (let i = 0; i < text.length; i += chunkSize) {
    const delta = text.slice(i, i + chunkSize);
    writeSse(res, { content: delta, sessionId: params.sessionId });
  }
}

function isDebugEnabled(req: Request): boolean {
  if (env.aiDebugMode) return true;

  const q = (req.query as any)?.debug;
  if (q === "1" || q === "true") return true;

  const h = String(req.headers["x-ai-debug"] ?? "").toLowerCase();
  if (h === "1" || h === "true") return true;

  const b = (req.body as any)?.debug;
  if (b === true || b === "true" || b === 1 || b === "1") return true;

  return false;
}

export class AiOrchestrator {
  private readonly chatService = new ChatService();
  private readonly studentService = new StudentService();
  private readonly teacherService = new TeacherService();
  private readonly settingsService = new AiSettingsService();
  private readonly toolConfig = new AiToolConfigService();
  private readonly logs = new AiUsageLogService();

  private readonly llm = new LlmService();

  private readonly classifier = new AiClassifier();
  private readonly responder = new AiResponder();

  handleChat = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return fail(res, 401, "Unauthorized");

    const rawMessage = req.body?.message;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const lang = detectLanguage(message);

    // Treat noise/ghost inputs as empty: do not call tools or LLM.
    if (!message || isIgnorableMessage(message)) {
      return fail(res, 400, "message is required");
    }

    const sessionIdRaw = req.body?.sessionId;
    const sessionIdInput = typeof sessionIdRaw === "string" ? sessionIdRaw : "";

    const contextLimitRaw = toNumber(
      req.body?.contextLimit,
      env.aiContextLimit,
    );
    const contextLimit = Math.min(Math.max(contextLimitRaw, 0), 20);

    const requestedModel =
      typeof req.body?.model === "string" && req.body.model.trim().length > 0
        ? req.body.model.trim()
        : undefined;

    // We still accept temperature for future flexibility, but keep the router deterministic.
    const temperature =
      typeof req.body?.temperature === "number" ? req.body.temperature : 0.2;

    // Resolve/create session and persist user message first (compat with existing DB)
    let session = sessionIdInput
      ? await this.chatService.getSession(user.id, sessionIdInput)
      : null;
    if (!session) {
      session = await this.chatService.createSession(user.id, "New Chat");
    }

    await this.chatService.addMessage({
      userId: user.id,
      sessionId: session.id,
      sender: ChatSender.USER,
      message: message.slice(0, 4_000),
    });

    if (session.title === "New Chat") {
      const title = message.slice(0, 60);
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { title },
        select: { id: true },
      });
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const settings = await this.settingsService.getOrCreate();
    if (!settings.isEnabled) {
      const reply = "AI system is currently disabled by admin.";
      streamText(res, { sessionId: session.id, text: reply });
      writeSseDone(res);
      res.end();
      await this.chatService.addMessage({
        userId: user.id,
        sessionId: session.id,
        sender: ChatSender.ASSISTANT,
        message: reply,
      });
      return;
    }

    const requestId = ((req as any).requestId ?? null) as string | null;
    const debug = isDebugEnabled(req);
    const startedAtMs = Date.now();

    const baseRuntime: AiDebugRuntime | null = debug
      ? createAiDebugRuntime({
          message,
          classification: { type: "llm", confidence: 0 },
          tool: { selected: null, reason: null },
          context: {
            userId: user.id ?? null,
            role: user.role ?? null,
            studentId: (user as any).studentId ?? null,
            teacherId: (user as any).teacherId ?? null,
            groupId: null,
            sessionId: session.id,
            requestId,
          },
          startedAt: new Date(startedAtMs),
        })
      : null;

    const logRow = await this.logs.logStart({
      userId: user.id ?? null,
      role: user.role ?? null,
      requestId,
      provider: null,
      model: requestedModel ?? null,
      userMessage: message.slice(0, 4_000),
      meta: {
        kind: "ai_chat",
        sessionId: session.id,
        debug,
      },
    });

    const run = async () => {
      const context = await buildContext({
        user,
        sessionId: session.id,
        contextLimit,
        studentService: this.studentService,
        teacherService: this.teacherService,
      });

      // Intent may depend on conversation history (follow-ups like "tomorrow").
      const baseIntent = detectIntent(message, lang);
      const scheduleScope = detectScheduleScope(message, lang);
      const prevTopic = inferPreviousTopicFromHistory({
        recentMessages: Array.isArray((context as any)?.recentMessages)
          ? ((context as any).recentMessages as any)
          : [],
        lang,
      });

      const intent: DetectedIntent =
        baseIntent !== "llm"
          ? baseIntent
          : scheduleScope && prevTopic === "tool:schedule"
            ? "tool:schedule"
            : baseIntent;

      if (baseRuntime) {
        baseRuntime.trace.context.groupId =
          (context as any)?.student?.group?.id ??
          (context as any)?.teacher?.department?.id ??
          null;
      }

      const toolDefs = listToolDefinitions().filter((t) =>
        t.allowedRoles.includes(user.role),
      );

      const allowedByConfig = await this.toolConfig.listAllowed(user.role);
      const allowedToolNames = allowedByConfig.map(
        (t) => t.name,
      ) as AiToolName[];

      // Intent routing policy:
      // - schedule/attendance/grades keywords -> tool
      // - everything else -> LLM response (no automatic tool fallback)
      const shouldUseTool = intent !== "llm";
      const decision = shouldUseTool
        ? await this.classifier.decide({
            message,
            context,
            tools: toolDefs,
            allowedToolNames,
            requestedModel,
            lang,
          })
        : await this.classifier.decide({
            message,
            context,
            tools: [],
            allowedToolNames: [],
            requestedModel,
            lang,
          });

      if (baseRuntime) {
        baseRuntime.trace.classification.type = decision.type;
        baseRuntime.trace.classification.confidence = decision.confidence;
        baseRuntime.trace.tool.selected =
          decision.type === "tool" ? decision.tool : null;
        baseRuntime.trace.tool.reason =
          typeof (decision as any).reason === "string"
            ? (decision as any).reason
            : null;
      }

      let assistantText = "";

      // Force a specific tool when intent is explicitly detected.
      // This avoids "tool-first" misroutes on random inputs.
      let forcedTool: AiToolName | null = null;
      if (intent === "tool:schedule") {
        if (user.role === "TEACHER") {
          forcedTool = "getTeacherDashboard";
        } else {
          if (scheduleScope === "week") forcedTool = "getWeeklySchedule";
          else if (scheduleScope === "month") forcedTool = "getMonthlySchedule";
          else if (scheduleScope === "tomorrow")
            forcedTool = "getWeeklySchedule";
          else forcedTool = "getTodaySchedule";
        }
      }
      if (intent === "tool:attendance") {
        forcedTool =
          user.role === "STUDENT" ? "getStudentAttendanceRecent" : null;
      }
      if (intent === "tool:grades") {
        forcedTool = user.role === "STUDENT" ? "getStudentGradesRecent" : null;
      }

      const toolToRun =
        intent === "llm"
          ? null
          : (forcedTool ??
            (decision.type === "tool"
              ? (decision.tool as AiToolName | null)
              : null));

      if (toolToRun) {
        const toolName = toolToRun;

        if (!allowedToolNames.includes(toolName)) {
          assistantText =
            lang === "ja"
              ? "すみません、この操作を実行する権限がありません。"
              : lang === "uz"
                ? "Uzr, bu so‘rov uchun ruxsat yo‘q."
                : "Sorry, you don't have permission to do that.";
        } else {
          if (debug) {
            console.log("AI TOOL SELECTED", {
              toolName,
              input: (forcedTool ? {} : decision.args) ?? {},
              requestId,
              sessionId: session.id,
            });
          }

          const toolStarted = Date.now();
          if (baseRuntime) baseRuntime.setToolName(toolName);

          const exec = await executeTool({
            user,
            requestId,
            toolName,
            args: forcedTool ? {} : (decision.args ?? {}),
            teacherService: this.teacherService,
          });

          // Follow-up support: if user asked "tomorrow" but we used weekly schedule tool,
          // filter tool rows to tomorrow before formatting.
          let toolResult: any = exec.result;
          if (
            scheduleScope === "tomorrow" &&
            toolName === "getWeeklySchedule" &&
            Array.isArray(exec.result)
          ) {
            const tomorrow = new Date();
            tomorrow.setHours(0, 0, 0, 0);
            tomorrow.setDate(tomorrow.getDate() + 1);
            toolResult = exec.result.filter((row: any) => {
              const d = row?.calendarDay?.date;
              return d instanceof Date ? sameLocalDay(d, tomorrow) : false;
            });
          }

          if (baseRuntime) baseRuntime.setToolName(null);
          const toolEnded = Date.now();

          if (debug) {
            console.log("TOOL RESULT", {
              toolName,
              ms: toolEnded - toolStarted,
              requestId,
              sessionId: session.id,
              resultPreview:
                Array.isArray(exec.result) && exec.result.length > 0
                  ? exec.result[0]
                  : exec.result,
            });
          }

          assistantText = this.responder.formatToolResponse({
            tool: toolName,
            result: toolResult,
            lang,
          });

          // If user asked specifically for tomorrow, present it as "tomorrow" rather than "weekly".
          if (
            scheduleScope === "tomorrow" &&
            toolName === "getWeeklySchedule"
          ) {
            const lines = assistantText.split(/\r?\n/);
            if (lines.length > 0) {
              if (lang === "ja") lines[0] = "明日の予定:";
              else if (lang === "uz") lines[0] = "Ertangi jadval:";
              else lines[0] = "Tomorrow's schedule:";

              // Strip leading ISO date from bullets: "- YYYY-MM-DD ..." -> "- ..."
              for (let i = 1; i < lines.length; i++) {
                lines[i] = lines[i].replace(
                  /^(\s*[-•*]\s+)\d{4}-\d{2}-\d{2}\s+/,
                  "$1",
                );
              }
              assistantText = lines.join("\n");
            }
          }

          if (
            baseRuntime &&
            (Array.isArray(exec.result) ? exec.result.length === 0 : false)
          ) {
            if (/schedule/i.test(toolName)) {
              baseRuntime.addWarning(
                "No schedule found — possible date filter issue (prefer gte/lte range)",
              );
            }
          }
        }
      } else {
        assistantText = (decision.response ?? "").trim();
        if (!assistantText) {
          assistantText =
            lang === "ja"
              ? "すみません、うまく回答できませんでした。言い換えてもらえますか？"
              : lang === "uz"
                ? "Uzr, javob tayyor bo‘lmadi. Savolni boshqacha qilib yozing."
                : "Sorry, I couldn't generate a response. Could you rephrase?";
        }
      }

      // Prevent repeating the exact same assistant response twice in a row.
      try {
        const last = await prisma.chat.findFirst({
          where: {
            userId: user.id,
            sessionId: session.id,
            sender: ChatSender.ASSISTANT,
          },
          orderBy: { timestamp: "desc" },
          select: { message: true },
        });

        if (last?.message) {
          const prev = last.message.trim();
          const next = assistantText.trim();

          const sim = jaccardSimilarity(prev, next);
          if (sim >= 0.92) {
            try {
              const system = {
                role: "system" as const,
                content:
                  "You are a helpful assistant. Rephrase the assistant reply to avoid repetition, " +
                  "while preserving the exact meaning and any factual details (times, subjects, names). " +
                  "Keep the same language as the original. Keep formatting similar (if there is a bullet list, keep a bullet list). " +
                  "Do not add new information. Output ONLY the rephrased reply text.",
              };
              const userMsg = {
                role: "user" as const,
                content: [`LANGUAGE: ${lang}`, "ORIGINAL_REPLY:", next].join(
                  "\n",
                ),
              };

              const out = await this.llm.chatJson({
                role: user.role,
                requestedModel,
                temperature: 0.4,
                maxTokens: 700,
                messages: [system, userMsg],
              });

              const rephrased = String(out.content ?? "").trim();
              if (rephrased && jaccardSimilarity(prev, rephrased) < 0.92) {
                assistantText = rephrased;
              } else {
                assistantText = nonRepeatingFallback(lang);
              }
            } catch {
              assistantText = nonRepeatingFallback(lang);
            }
          }
        }
      } catch {
        // ignore (never block response)
      }

      if (debug) {
        console.log("FINAL AI RESPONSE", {
          requestId,
          sessionId: session.id,
          preview: assistantText.slice(0, 220),
        });
      }

      streamText(res, { sessionId: session.id, text: assistantText });
      writeSseDone(res);
      res.end();

      await this.chatService.addMessage({
        userId: user.id,
        sessionId: session.id,
        sender: ChatSender.ASSISTANT,
        message: assistantText,
      });

      const endedAtMs = Date.now();
      if (baseRuntime) {
        finalizeAiDebugTrace({
          runtime: baseRuntime,
          startedAtMs,
          endedAtMs,
          finalResponse: assistantText,
        });
      }

      await this.logs.logFinish({
        id: logRow.id,
        toolName:
          decision.type === "tool" && decision.tool
            ? (decision.tool as any)
            : null,
        toolArgs: decision.type === "tool" ? (decision.args ?? {}) : {},
        assistantMessage: assistantText,
        status: "OK",
        error: null,
        ms: endedAtMs - startedAtMs,
        meta: {
          kind: "ai_chat",
          sessionId: session.id,
          debug,
          debugTrace: baseRuntime ? baseRuntime.trace : null,
        },
      });

      return;
    };

    try {
      if (baseRuntime) {
        return await runWithAiDebugRuntime(baseRuntime, run);
      }

      return await run();
    } catch (error: any) {
      console.error("AiOrchestrator.handleChat failed:", error);

      if (baseRuntime) {
        baseRuntime.addError(
          typeof error?.message === "string"
            ? error.message
            : "AI_REQUEST_FAILED",
        );
        finalizeAiDebugTrace({
          runtime: baseRuntime,
          startedAtMs,
          endedAtMs: Date.now(),
          finalResponse: "",
        });
      }

      try {
        await this.logs.logFinish({
          id: logRow.id,
          toolName: null,
          toolArgs: {},
          assistantMessage: null,
          status: "ERROR",
          error:
            typeof error?.message === "string"
              ? error.message
              : "AI_REQUEST_FAILED",
          ms: Date.now() - startedAtMs,
          meta: {
            kind: "ai_chat",
            sessionId: session.id,
            debug,
            debugTrace: baseRuntime ? baseRuntime.trace : null,
          },
        });
      } catch (e) {
        console.error("AiOrchestrator.handleChat logFinish failed:", e);
      }

      try {
        writeSse(res, { error: "AI request failed", sessionId: session.id });
        writeSseDone(res);
        res.end();
      } catch {
        // ignore
      }
      return;
    }
  };
}
