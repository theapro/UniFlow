import type { Request, Response } from "express";
import { ChatSender, UserRole } from "@prisma/client";
import type { AiIntent } from "../../types/ai";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";
import { AiDataService } from "../../services/ai/AiDataService";
import {
  GroqChatService,
  type LlmMessage,
} from "../../services/ai/GroqChatService";
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

export class AiController {
  private readonly aiDataService: AiDataService;
  private readonly groqChatService: GroqChatService;
  private readonly chatService: ChatService;
  private readonly userProfileService: UserProfileService;

  constructor(
    private readonly studentService: StudentService,
    private readonly teacherService: TeacherService,
  ) {
    this.aiDataService = new AiDataService();
    this.groqChatService = new GroqChatService();
    this.chatService = new ChatService();
    this.userProfileService = new UserProfileService();
  }

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

    const model =
      typeof req.body?.model === "string" && req.body.model.trim()
        ? req.body.model.trim()
        : undefined;
    const temperature =
      typeof req.body?.temperature === "number" ? req.body.temperature : 0.7;

    try {
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
        })}`,
      );

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
        model,
        temperature,
        messages: llmMessages,
        callbacks: {
          onDelta: (delta) => {
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

      // Minimal profile inference from the latest user message
      await this.userProfileService.inferFromMessage(user.id, message);
    } catch (error) {
      console.error("llmChat failed:", error);
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
