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
import {
  createAiDebugRuntime,
  finalizeAiDebugTrace,
  runWithAiDebugRuntime,
  type AiDebugRuntime,
} from "../../services/ai-debug/aiDebugTrace";

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

  private readonly classifier = new AiClassifier();
  private readonly responder = new AiResponder();

  handleChat = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return fail(res, 401, "Unauthorized");

    const rawMessage = req.body?.message;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    if (!message) return fail(res, 400, "message is required");

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

      const decision = await this.classifier.decide({
        message,
        context,
        tools: toolDefs,
        allowedToolNames,
        requestedModel,
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

      if (decision.type === "tool" && decision.tool) {
        const toolName = decision.tool as AiToolName;

        if (!allowedToolNames.includes(toolName)) {
          assistantText =
            "Uzr, bu so‘rov uchun ruxsat etilgan tool topilmadi. Iltimos, aniqlashtirib yozing.";
        } else {
          if (debug) {
            console.log("AI TOOL SELECTED", {
              toolName,
              input: decision.args ?? {},
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
            args: decision.args ?? {},
            teacherService: this.teacherService,
          });

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
            result: exec.result,
          });

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
            "Uzr, javob tayyor bo‘lmadi. Savolni biroz boshqacha qilib bera olasizmi?";
        }
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
