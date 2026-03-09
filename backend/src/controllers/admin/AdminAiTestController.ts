import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { fail, ok } from "../../utils/responses";
import { AiAssistantService } from "../../services/ai/AiAssistantService";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";

type TestAsRole = "STUDENT" | "TEACHER";

export class AdminAiTestController {
  private readonly assistant = new AiAssistantService();
  private readonly logs = new AiUsageLogService();

  chat = async (req: Request, res: Response) => {
    try {
      const message = (req.body?.message ?? "") as unknown;
      if (typeof message !== "string" || message.trim().length === 0) {
        return fail(res, 400, "message is required");
      }

      const asRole = (req.body?.asRole ?? "STUDENT") as unknown;
      if (asRole !== "STUDENT" && asRole !== "TEACHER") {
        return fail(res, 400, "asRole must be STUDENT or TEACHER");
      }

      const requestedModel =
        typeof req.body?.requestedModel === "string"
          ? req.body.requestedModel
          : undefined;

      const userId =
        typeof req.body?.userId === "string" ? req.body.userId : null;

      const impersonated = await this.pickUser({
        asRole,
        userId,
      });

      if (!impersonated) {
        return fail(res, 404, `No user found for role ${asRole}`);
      }

      const requestId = `admin_testai_${randomUUID()}`;

      const result = await this.assistant.chat({
        user: impersonated as any,
        requestId,
        message: message.trim().slice(0, 4_000),
        requestedModel,
      });

      const log = await this.logs.findLatestByRequestId({ requestId });

      return ok(res, "OK", {
        reply: result.reply,
        toolUsed: result.toolUsed,
        requestId,
        debug: {
          log,
        },
      });
    } catch (error: any) {
      const msg =
        typeof error?.message === "string" ? error.message : "TEST_AI_FAILED";
      console.error("AdminAiTestController.chat failed:", error);
      return fail(res, 500, msg);
    }
  };

  private async pickUser(params: {
    asRole: TestAsRole;
    userId: string | null;
  }): Promise<
    | {
        id: string;
        email: string;
        role: "STUDENT" | "TEACHER" | "ADMIN";
        fullName: string | null;
        studentId: string | null;
        teacherId: string | null;
      }
    | null
  > {
    if (params.userId) {
      const u = await prisma.user.findUnique({
        where: { id: params.userId },
        select: {
          id: true,
          email: true,
          role: true,
          studentId: true,
          teacherId: true,
          student: { select: { fullName: true } },
          teacher: { select: { fullName: true } },
        },
      });

      if (!u) return null;
      if (params.asRole === "STUDENT" && u.role !== "STUDENT") {
        return null;
      }
      if (params.asRole === "TEACHER" && u.role !== "TEACHER") {
        return null;
      }

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        fullName:
          params.asRole === "STUDENT"
            ? u.student?.fullName ?? null
            : u.teacher?.fullName ?? null,
        studentId: u.studentId ?? null,
        teacherId: u.teacherId ?? null,
      };
    }

    const u = await prisma.user.findFirst({
      where:
        params.asRole === "STUDENT"
          ? { role: "STUDENT" }
          : { role: "TEACHER" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        studentId: true,
        teacherId: true,
        student: { select: { fullName: true } },
        teacher: { select: { fullName: true } },
      },
    });

    if (!u) return null;

    return {
      id: u.id,
      email: u.email,
      role: u.role,
      fullName:
        params.asRole === "STUDENT"
          ? u.student?.fullName ?? null
          : u.teacher?.fullName ?? null,
      studentId: u.studentId ?? null,
      teacherId: u.teacherId ?? null,
    };
  }
}
