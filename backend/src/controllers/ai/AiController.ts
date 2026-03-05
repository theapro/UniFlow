import type { Request, Response } from "express";
import { AiModality, ChatSender, UserRole } from "@prisma/client";
import type { AiIntent } from "../../types/ai";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";
import { AiDataService } from "../../services/ai/AiDataService";
import {
  GroqChatService,
  type LlmMessage,
} from "../../services/ai/GroqChatService";
import { AiModelService } from "../../services/ai/AiModelService";
import { ChatService } from "../../services/chat/ChatService";
import { UserProfileService } from "../../services/user/UserProfileService";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/responses";

function detectIntent(message: string): AiIntent {
  const normalized = message.trim().toLowerCase();

  if (
    /(today|todays|to day).*(schedule|timetable)/.test(normalized) ||
    /my schedule today/.test(normalized)
  ) {
    return "GET_TODAY_SCHEDULE";
  }

  if (
    /(today|todays|to day).*(lesson|classes)/.test(normalized) ||
    /my lessons today/.test(normalized)
  ) {
    return "GET_TODAY_LESSONS";
  }

  if (/(attendance|absent|present|late)/.test(normalized)) {
    return "GET_ATTENDANCE";
  }

  return "UNKNOWN";
}

const THINK_OPEN = "<think>";
const THINK_CLOSE = "</think>";

function createThinkTagStripper() {
  let inThink = false;
  let carry = "";

  function process(chunk: string): string {
    if (!chunk) return "";

    let s = carry + chunk;
    carry = "";

    let out = "";
    let i = 0;

    while (i < s.length) {
      if (inThink) {
        const endIdx = s.indexOf(THINK_CLOSE, i);
        if (endIdx === -1) {
          const tailLen = Math.min(THINK_CLOSE.length - 1, s.length - i);
          carry = s.slice(s.length - tailLen);
          return out;
        }

        i = endIdx + THINK_CLOSE.length;
        inThink = false;
        continue;
      }

      const startIdx = s.indexOf(THINK_OPEN, i);
      if (startIdx === -1) {
        const tailLen = Math.min(THINK_OPEN.length - 1, s.length - i);
        out += s.slice(i, s.length - tailLen);
        carry = s.slice(s.length - tailLen);
        return out;
      }

      out += s.slice(i, startIdx);
      i = startIdx + THINK_OPEN.length;
      inThink = true;
    }

    return out;
  }

  function flush(): string {
    if (inThink) {
      // If the stream ends while inside <think>, discard it.
      carry = "";
      return "";
    }

    const out = carry;
    carry = "";
    return out;
  }

  return { process, flush };
}

export class AiController {
  private readonly aiDataService: AiDataService;
  private readonly groqChatService: GroqChatService;
  private readonly aiModelService: AiModelService;
  private readonly chatService: ChatService;
  private readonly userProfileService: UserProfileService;

  constructor(
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
  ) {
    this.aiDataService = new AiDataService();
    this.groqChatService = new GroqChatService();
    this.aiModelService = new AiModelService();
    this.chatService = new ChatService();
    this.userProfileService = new UserProfileService();
  }

  listAllowedModels = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const models = await this.aiModelService.listAllowedForRole({
        role: user.role,
        modality: AiModality.CHAT,
      });

      return ok(
        res,
        "OK",
        models.map((m) => ({
          id: m.id,
          provider: m.provider,
          model: m.model,
          displayName: m.displayName,
          modality: m.modality,
        })),
      );
    } catch (error) {
      console.error("listAllowedModels failed:", error);
      return fail(res, 500, "Failed to list models");
    }
  };

  getGreeting = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const profile = await this.userProfileService.getOrCreate(user.id);

      const student = user.studentId
        ? await prisma.student.findUnique({
            where: { id: user.studentId },
            select: {
              id: true,
              fullName: true,
              studentNo: true,
              group: { select: { id: true, name: true } },
            },
          })
        : null;

      const teacher = user.teacherId
        ? await prisma.teacher.findUnique({
            where: { id: user.teacherId },
            select: {
              id: true,
              fullName: true,
              staffNo: true,
              department: { select: { id: true, name: true } },
            },
          })
        : null;

      const resolvedModel = await this.aiModelService.resolveChatModel({
        role: user.role,
      });

      const ctx = {
        role: user.role,
        name: user.fullName ?? null,
        email: user.email,
        student: student
          ? {
              id: student.id,
              name: student.fullName,
              studentNo: student.studentNo,
              group: student.group,
            }
          : null,
        teacher: teacher
          ? {
              id: teacher.id,
              name: teacher.fullName,
              staffNo: teacher.staffNo,
              department: teacher.department,
            }
          : null,
        interests: profile.interests ?? null,
        preferences: profile.preferences ?? null,
      };

      let full = "";
      const stripper = createThinkTagStripper();
      await this.groqChatService.streamChat({
        model: resolvedModel.model,
        maxTokens: 80,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content:
              "You generate a short, creative Uzbek greeting for the UniFlow AI chat empty state. Use the provided user context. Output ONLY one sentence (max 12 words), no quotes, no emojis. Do not output <think> tags or hidden reasoning.",
          },
          {
            role: "user",
            content: `USER CONTEXT:\n${JSON.stringify(ctx)}`,
          },
        ],
        callbacks: {
          onDelta: (d) => {
            full += stripper.process(d);
          },
        },
      });

      full += stripper.flush();

      const greeting = full.trim().replace(/^"|"$/g, "");
      return ok(res, "OK", {
        greeting:
          greeting.length > 0
            ? greeting.slice(0, 140)
            : "Qanday yordam bera olaman?",
        model: resolvedModel.model,
      });
    } catch (error) {
      console.error("getGreeting failed:", error);
      return ok(res, "OK", { greeting: "Qanday yordam bera olaman?" });
    }
  };

  verifyStudent = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const studentId = (req.body?.studentId ?? "") as unknown;
      const group = (req.body?.group ?? "") as unknown;

      if (typeof studentId !== "string" || studentId.trim().length === 0) {
        return fail(res, 400, "studentId is required");
      }
      if (typeof group !== "string" || group.trim().length === 0) {
        return fail(res, 400, "group is required");
      }

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          fullName: true,
          studentNo: true,
          groupId: true,
          group: { select: { id: true, name: true } },
        },
      });

      if (!student) return fail(res, 404, "Student not found");

      const groupNormalized = group.trim().toLowerCase();
      const matchesGroupId = student.groupId?.toLowerCase() === groupNormalized;
      const matchesGroupName =
        student.group?.name?.trim().toLowerCase() === groupNormalized;

      if (!matchesGroupId && !matchesGroupName) {
        return fail(res, 400, "Student group mismatch");
      }

      return ok(res, "OK", {
        student: {
          id: student.id,
          name: student.fullName,
          studentNo: student.studentNo,
          group: student.group,
        },
      });
    } catch (error) {
      console.error("verifyStudent failed:", error);
      return fail(res, 500, "Student verification failed");
    }
  };

  listChatSessions = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessions = await this.chatService.listSessions(user.id);
      return ok(res, "OK", sessions);
    } catch (error) {
      console.error("listChatSessions failed:", error);
      return fail(res, 500, "Failed to list chat sessions");
    }
  };

  createChatSession = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const titleRaw = (req.body?.title ?? "New Chat") as unknown;
      const title =
        typeof titleRaw === "string" && titleRaw.trim().length > 0
          ? titleRaw.trim().slice(0, 120)
          : "New Chat";

      const session = await this.chatService.createSession(user.id, title);
      return ok(res, "OK", session);
    } catch (error) {
      console.error("createChatSession failed:", error);
      return fail(res, 500, "Failed to create chat session");
    }
  };

  renameChatSession = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessionId = String(req.params.sessionId ?? "");
      const titleRaw = (req.body?.title ?? "") as unknown;
      if (typeof titleRaw !== "string" || titleRaw.trim().length === 0) {
        return fail(res, 400, "title is required");
      }

      const updated = await this.chatService.renameSession(
        user.id,
        sessionId,
        titleRaw.trim().slice(0, 120),
      );
      if (!updated) return fail(res, 404, "Session not found");

      return ok(res, "OK", updated);
    } catch (error) {
      console.error("renameChatSession failed:", error);
      return fail(res, 500, "Failed to rename chat session");
    }
  };

  deleteChatSession = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessionId = String(req.params.sessionId ?? "");
      const deleted = await this.chatService.deleteSession(user.id, sessionId);
      if (!deleted) return fail(res, 404, "Session not found");
      return ok(res, "OK");
    } catch (error) {
      console.error("deleteChatSession failed:", error);
      return fail(res, 500, "Failed to delete chat session");
    }
  };

  listChatMessages = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessionId = String(req.params.sessionId ?? "");
      const limitParam = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), 200)
        : 50;

      const messages = await this.chatService.listMessages(
        user.id,
        sessionId,
        limit,
      );
      if (!messages) return fail(res, 404, "Session not found");
      return ok(res, "OK", messages);
    } catch (error) {
      console.error("listChatMessages failed:", error);
      return fail(res, 500, "Failed to list messages");
    }
  };

  llmChat = async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) return fail(res, 401, "Unauthorized");

    const message = (req.body?.message ?? "") as unknown;
    if (typeof message !== "string" || message.trim().length === 0) {
      return fail(res, 400, "message is required");
    }

    const sessionIdRaw = (req.body?.sessionId ?? "") as unknown;
    const sessionId = typeof sessionIdRaw === "string" ? sessionIdRaw : "";
    const contextLimitRaw = Number(
      req.body?.contextLimit ?? env.aiContextLimit,
    );
    const contextLimit = Number.isFinite(contextLimitRaw)
      ? Math.min(Math.max(contextLimitRaw, 1), 50)
      : 15;

    const requestedModel =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : undefined;
    const temperature =
      typeof req.body?.temperature === "number" ? req.body.temperature : 0.7;

    try {
      const resolvedModel = await this.aiModelService.resolveChatModel({
        role: user.role,
        requestedModel,
      });

      const startedAt = Date.now();
      console.info("[AI] chat:start", {
        userId: user.id,
        sessionId: sessionId || undefined,
        requestedModel: requestedModel ?? null,
        resolvedModel: resolvedModel.model,
        modelSource: resolvedModel.source,
        contextLimit,
        temperature,
      });

      // Resolve or create session
      let session = sessionId
        ? await this.chatService.getSession(user.id, sessionId)
        : null;

      if (!session) {
        session = await this.chatService.createSession(user.id, "New Chat");
      }

      // Student context
      const inputStudentId =
        typeof req.body?.studentId === "string"
          ? req.body.studentId.trim()
          : "";
      const inputGroup =
        typeof req.body?.group === "string" ? req.body.group.trim() : "";

      let studentContext: any = null;
      if (inputStudentId && inputGroup) {
        const student = await prisma.student.findUnique({
          where: { id: inputStudentId },
          select: {
            id: true,
            fullName: true,
            studentNo: true,
            groupId: true,
            group: { select: { id: true, name: true } },
          },
        });

        if (!student) {
          return fail(res, 400, "Invalid studentId");
        }

        const groupNormalized = inputGroup.toLowerCase();
        const matchesGroupId =
          student.groupId?.toLowerCase() === groupNormalized;
        const matchesGroupName =
          student.group?.name?.trim().toLowerCase() === groupNormalized;
        if (!matchesGroupId && !matchesGroupName) {
          return fail(res, 400, "Student group mismatch");
        }

        studentContext = {
          id: student.id,
          name: student.fullName,
          studentNo: student.studentNo,
          group: student.group,
        };
      } else if (user.studentId) {
        const student = await prisma.student.findUnique({
          where: { id: user.studentId },
          select: {
            id: true,
            fullName: true,
            studentNo: true,
            group: { select: { id: true, name: true } },
          },
        });
        if (student) {
          studentContext = {
            id: student.id,
            name: student.fullName,
            studentNo: student.studentNo,
            group: student.group,
          };
        }
      }

      // Profile context
      const profile = await this.userProfileService.getOrCreate(user.id);

      // Authenticated user meta (safe to share back to the same user)
      const userMeta = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          studentId: true,
          teacherId: true,
        },
      });

      // Role-based, compact "today" context
      let todayContext: any = null;
      if (user.role === UserRole.STUDENT && user.studentId) {
        try {
          const schedule = await this.studentService.getTodaySchedule(
            user.studentId,
          );
          todayContext = {
            kind: "student_schedule",
            items: schedule.slice(0, 10).map((s: any) => ({
              subject: s?.subject?.name ?? null,
              teacher: s?.teacher?.fullName ?? null,
              room: s?.room?.name ?? null,
              startTime: s?.timeSlot?.startTime ?? null,
              endTime: s?.timeSlot?.endTime ?? null,
            })),
          };
        } catch {
          todayContext = null;
        }
      }

      if (user.role === UserRole.TEACHER && user.teacherId) {
        try {
          const lessons = await this.teacherService.getTodayLessons(
            user.teacherId,
          );
          todayContext = {
            kind: "teacher_lessons",
            items: lessons.slice(0, 10).map((l: any) => ({
              subject: l?.subject?.name ?? null,
              group: l?.group?.name ?? null,
              startsAt: l?.startsAt ?? null,
              endsAt: l?.endsAt ?? null,
            })),
          };
        } catch {
          todayContext = null;
        }
      }

      // Chat history context (last N messages)
      const historyRows =
        (await this.chatService.listMessages(
          user.id,
          session.id,
          contextLimit,
        )) ?? [];

      const systemParts: string[] = [];
      systemParts.push(
        "You are UniFlow AI. Use the provided context (student profile, user profile, and recent chat history) to respond. If you are missing required details, ask concise clarifying questions.",
      );

      systemParts.push(
        "ALWAYS output a reasoning section wrapped in <think>...</think> first, then output the final answer OUTSIDE the <think> tags. The UI will hide <think> by default.",
      );

      systemParts.push(
        "Default language: Uzbek. If the user writes in another language, reply in that language.",
      );

      systemParts.push(
        "Do NOT output an 'Izoh:' line or any extra footer text. Put any explanation inside <think>.",
      );

      systemParts.push(
        `AUTHENTICATED USER:\n${JSON.stringify({
          id: userMeta?.id ?? user.id,
          email: userMeta?.email ?? user.email,
          role: userMeta?.role ?? user.role,
          fullName: user.fullName ?? null,
          createdAt: userMeta?.createdAt ?? null,
          lastLoginAt: userMeta?.lastLoginAt ?? null,
          studentId: userMeta?.studentId ?? user.studentId ?? null,
          teacherId: userMeta?.teacherId ?? user.teacherId ?? null,
        })}`,
      );

      if (studentContext) {
        systemParts.push(
          `STUDENT CONTEXT (verified):\n${JSON.stringify(studentContext)}`,
        );
      }

      systemParts.push(
        `USER PROFILE CONTEXT:\n${JSON.stringify({
          interests: profile.interests ?? null,
          preferences: profile.preferences ?? null,
          notes: profile.notes ?? null,
          updatedAt: profile.updatedAt ?? null,
        })}`,
      );

      if (todayContext) {
        systemParts.push(`TODAY CONTEXT:\n${JSON.stringify(todayContext)}`);
      }

      const llmMessages: LlmMessage[] = [
        { role: "system", content: systemParts.join("\n\n") },
      ];

      for (const row of historyRows) {
        if (row.sender === ChatSender.USER) {
          llmMessages.push({ role: "user", content: row.message });
        } else if (row.sender === ChatSender.ASSISTANT) {
          llmMessages.push({ role: "assistant", content: row.message });
        }
      }

      // Persist user message
      await this.chatService.addMessage({
        userId: user.id,
        sessionId: session.id,
        sender: ChatSender.USER,
        message: message.trim(),
      });

      llmMessages.push({ role: "user", content: message.trim() });

      // If this is the first user message, auto-title the session.
      if (session.title === "New Chat" && historyRows.length === 0) {
        const title = message.trim().slice(0, 60);
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

      let assistantFull = "";
      await this.groqChatService.streamChat({
        model: resolvedModel.model,
        maxTokens: Number.isFinite(env.aiMaxTokens)
          ? Math.min(Math.max(env.aiMaxTokens, 256), 8192)
          : 2048,
        temperature,
        messages: llmMessages,
        callbacks: {
          onDelta: (delta) => {
            if (!delta) return;
            assistantFull += delta;
            res.write(
              `data: ${JSON.stringify({ content: delta, sessionId: session.id })}\n\n`,
            );
          },
        },
      });

      res.write("data: [DONE]\n\n");
      res.end();

      if (assistantFull.trim().length > 0) {
        await this.chatService.addMessage({
          userId: user.id,
          sessionId: session.id,
          sender: ChatSender.ASSISTANT,
          message: assistantFull,
        });
      }

      console.info("[AI] chat:done", {
        userId: user.id,
        sessionId: session.id,
        model: resolvedModel.model,
        ms: Date.now() - startedAt,
        chars: assistantFull.length,
        preview: assistantFull.slice(0, 500),
      });

      // Minimal profile inference from the latest user message
      await this.userProfileService.inferFromMessage(user.id, message);
    } catch (error) {
      if ((error as any)?.code === "MODEL_NOT_ALLOWED") {
        return fail(res, 403, "Model is not allowed by admin policy");
      }
      console.error("llmChat failed:", error);

      try {
        console.info("[AI] chat:error", {
          userId: user.id,
          sessionId: sessionId || undefined,
          requestedModel: requestedModel ?? null,
        });
      } catch {
        // ignore
      }
      // If we already started SSE, try to close gracefully
      try {
        res.write(
          `data: ${JSON.stringify({ error: "AI request failed" })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {
        // ignore
      }
      return;
    }
  };

  getSystemContext = async (req: Request, res: Response) => {
    try {
      const summary = await this.aiDataService.getSystemSummary();
      return ok(res, "OK", summary);
    } catch (error) {
      console.error("Failed to get system context:", error);
      return fail(res, 500, "Failed to fetch university data");
    }
  };

  searchData = async (req: Request, res: Response) => {
    try {
      const { type, q } = req.query;

      if (type === "student") {
        const results = await this.aiDataService.searchStudents(String(q));
        return ok(res, "OK", results);
      }

      if (type === "group") {
        const results = await this.aiDataService.getGroupDetails(String(q));
        return ok(res, "OK", results);
      }

      return fail(res, 400, "Invalid search type");
    } catch (error) {
      return fail(res, 500, "Search failed");
    }
  };

  chat = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return fail(res, 401, "Unauthorized");
      }

      const message = (req.body?.message ?? "") as unknown;
      if (typeof message !== "string" || message.trim().length === 0) {
        return fail(res, 400, "message is required");
      }

      const intent = detectIntent(message);

      if (intent === "UNKNOWN") {
        return ok(res, "Intent not recognized", {
          intent,
          reply:
            "I can help with today's schedule, today's lessons, or attendance.",
        });
      }

      if (intent === "GET_TODAY_SCHEDULE") {
        if (user.role === UserRole.STUDENT) {
          if (!user.studentId)
            return fail(res, 400, "Student profile not linked");
          const schedule = await this.studentService.getTodaySchedule(
            user.studentId,
          );
          return ok(res, "OK", { intent, data: schedule });
        }

        if (user.role === UserRole.TEACHER) {
          if (!user.teacherId)
            return fail(res, 400, "Teacher profile not linked");
          const lessons = await this.teacherService.getTodayLessons(
            user.teacherId,
          );
          return ok(res, "OK", { intent: "GET_TODAY_LESSONS", data: lessons });
        }

        return fail(res, 403, "Admins should use admin endpoints");
      }

      if (intent === "GET_TODAY_LESSONS") {
        if (user.role !== UserRole.TEACHER) {
          return fail(res, 403, "Only teachers can view today's lessons");
        }
        if (!user.teacherId)
          return fail(res, 400, "Teacher profile not linked");
        const lessons = await this.teacherService.getTodayLessons(
          user.teacherId,
        );
        return ok(res, "OK", { intent, data: lessons });
      }

      if (intent === "GET_ATTENDANCE") {
        if (user.role !== UserRole.STUDENT) {
          return fail(res, 403, "Only students can view attendance");
        }
        if (!user.studentId)
          return fail(res, 400, "Student profile not linked");
        const attendance = await this.studentService.getAttendance(
          user.studentId,
        );
        return ok(res, "OK", { intent, data: attendance });
      }

      return ok(res, "OK", { intent, data: null });
    } catch {
      return fail(res, 500, "AI request failed");
    }
  };
}
