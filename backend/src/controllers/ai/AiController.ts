import type { Request, Response } from "express";
import { AiModality, ChatSender } from "@prisma/client";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";
import { AiDataService } from "../../services/ai/AiDataService";
import { GroqChatService } from "../../services/ai/GroqChatService";
import { AiModelService } from "../../services/ai/AiModelService";
import { ChatService } from "../../services/chat/ChatService";
import { UserProfileService } from "../../services/user/UserProfileService";
import { prisma } from "../../config/prisma";
import { fail, ok } from "../../utils/responses";

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
              studentNumber: true,
              studentGroups: {
                where: { leftAt: null },
                select: { group: { select: { id: true, name: true } } },
                orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
                take: 1,
              },
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
              studentNo: student.studentNumber,
              group: student.studentGroups[0]?.group ?? null,
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
      await this.groqChatService.streamChat({
        model: resolvedModel.model,
        maxTokens: 80,
        temperature: 0.8,
        messages: [
          {
            role: "system",
            content:
              "You generate a short, creative Uzbek greeting for the UniFlow AI chat empty state. Use the provided user context. Output ONLY one sentence (max 12 words), no quotes, no emojis. Do not output hidden reasoning.",
          },
          {
            role: "user",
            content: `USER CONTEXT:\n${JSON.stringify(ctx)}`,
          },
        ],
        callbacks: {
          onDelta: (d) => {
            full += d;
          },
        },
      });

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
          studentNumber: true,
          studentGroups: {
            where: { leftAt: null },
            select: { group: { select: { id: true, name: true } } },
            orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
          },
        },
      });

      if (!student) return fail(res, 404, "Student not found");

      const groupNormalized = group.trim().toLowerCase();
      const resolvedGroup = student.studentGroups[0]?.group ?? null;
      const matchesGroupId =
        resolvedGroup?.id?.trim().toLowerCase() === groupNormalized;
      const matchesGroupName =
        resolvedGroup?.name?.trim().toLowerCase() === groupNormalized;

      if (!matchesGroupId && !matchesGroupName) {
        return fail(res, 400, "Student group mismatch");
      }

      return ok(res, "OK", {
        student: {
          id: student.id,
          name: student.fullName,
          studentNo: student.studentNumber,
          group: resolvedGroup,
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

  addChatMessage = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessionId = String(req.params.sessionId ?? "");

      const senderRaw = (req.body?.sender ?? "") as unknown;
      const messageRaw = (req.body?.message ?? "") as unknown;

      const senderStr =
        typeof senderRaw === "string" ? senderRaw.trim().toUpperCase() : "";
      const sender: ChatSender | null =
        senderStr === "USER"
          ? ChatSender.USER
          : senderStr === "ASSISTANT"
            ? ChatSender.ASSISTANT
            : null;

      if (!sender) return fail(res, 400, "sender must be USER or ASSISTANT");
      if (typeof messageRaw !== "string" || messageRaw.trim().length === 0) {
        return fail(res, 400, "message is required");
      }

      const message = messageRaw.trim().slice(0, 20000);

      const row = await this.chatService.addMessage({
        userId: user.id,
        sessionId,
        sender,
        message,
      });

      if (!row) return fail(res, 404, "Session not found");

      return ok(res, "OK", row);
    } catch (error) {
      console.error("addChatMessage failed:", error);
      return fail(res, 500, "Failed to add message");
    }
  };

  exportChatMessages = async (req: Request, res: Response) => {
    try {
      const user = req.user;
      if (!user) return fail(res, 401, "Unauthorized");

      const sessionId = String(req.params.sessionId ?? "");
      const limitParam = Number(req.query.limit ?? 5000);
      const limit = Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), 5000)
        : 5000;

      const messages = await this.chatService.listMessages(
        user.id,
        sessionId,
        limit,
      );
      if (!messages) return fail(res, 404, "Session not found");
      return ok(res, "OK", messages);
    } catch (error) {
      console.error("exportChatMessages failed:", error);
      return fail(res, 500, "Failed to export messages");
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
}
