import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { fail, ok } from "../../utils/responses";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";
import {
  AI_TOOL_NAMES,
  type AiToolName,
} from "../../services/ai-tools/toolNames";
import { AiClassifier } from "../../ai/core/AiClassifier";
import { AiResponder } from "../../ai/core/AiResponder";
import { buildContext } from "../../ai/context/buildContext";
import { listToolDefinitions } from "../../ai/tools/toolRegistry";
import { executeTool } from "../../ai/tools/executeTool";
import { AiAccessError } from "../../ai/tools/access";
import { AiToolConfigService } from "../../services/ai/AiToolConfigService";
import { StudentService } from "../../services/user/StudentService";
import { TeacherService } from "../../services/user/TeacherService";

type TestAsRole = "STUDENT" | "TEACHER" | "ADMIN";

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

export class AdminAiTestController {
  private readonly logs = new AiUsageLogService();
  private readonly classifier = new AiClassifier();
  private readonly responder = new AiResponder();
  private readonly toolConfig = new AiToolConfigService();
  private readonly studentService = new StudentService();
  private readonly teacherService = new TeacherService();

  chat = async (req: Request, res: Response) => {
    try {
      const message = (req.body?.message ?? "") as unknown;
      if (typeof message !== "string" || message.trim().length === 0) {
        return fail(res, 400, "message is required");
      }

      const asRole = (req.body?.asRole ?? "STUDENT") as unknown;
      if (asRole !== "STUDENT" && asRole !== "TEACHER" && asRole !== "ADMIN") {
        return fail(res, 400, "asRole must be STUDENT, TEACHER, or ADMIN");
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

      const context = await buildContext({
        user: impersonated as any,
        sessionId: null,
        contextLimit: 0,
        studentService: this.studentService,
        teacherService: this.teacherService,
      });

      const toolDefs = listToolDefinitions().filter((t) =>
        t.allowedRoles.includes(impersonated.role as any),
      );

      const allowedByConfig = await this.toolConfig.listAllowed(
        impersonated.role as any,
      );
      const allowedToolNames = allowedByConfig.map(
        (t) => t.name,
      ) as AiToolName[];

      const decision = await this.classifier.decide({
        message: message.trim().slice(0, 4_000),
        context,
        tools: toolDefs,
        allowedToolNames,
        requestedModel,
      });

      let reply = "";
      let toolUsed: AiToolName | null = null;

      if (decision.type === "tool" && decision.tool) {
        toolUsed = decision.tool as AiToolName;
        const exec = await executeTool({
          user: impersonated as any,
          requestId,
          toolName: toolUsed,
          args: decision.args ?? {},
          teacherService: this.teacherService,
        });
        reply = this.responder.formatToolResponse({
          tool: toolUsed,
          result: exec.result,
        });
      } else {
        reply = String(decision.response ?? "").trim();
      }

      const log = await this.logs.findLatestByRequestId({ requestId });

      return ok(res, "OK", {
        reply,
        toolUsed,
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

  runTool = async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const requestId = `admin_testtool_${randomUUID()}`;

    try {
      const rawTool = (req.body?.tool ?? req.body?.toolName ?? "") as unknown;
      const toolName = String(rawTool ?? "").trim() as AiToolName;
      if (!toolName) return fail(res, 400, "tool is required");
      if (!(AI_TOOL_NAMES as readonly string[]).includes(toolName)) {
        return fail(res, 400, "Unknown tool");
      }

      const args = (req.body?.args ?? {}) as unknown;
      if (!args || typeof args !== "object" || Array.isArray(args)) {
        return fail(res, 400, "args must be an object");
      }

      const asRole = (req.body?.asRole ?? "ADMIN") as unknown;
      if (asRole !== "STUDENT" && asRole !== "TEACHER" && asRole !== "ADMIN") {
        return fail(res, 400, "asRole must be STUDENT, TEACHER, or ADMIN");
      }

      const userId =
        typeof req.body?.userId === "string" ? req.body.userId : null;

      const impersonated = await this.pickUser({ asRole, userId });
      if (!impersonated) {
        return fail(res, 404, `No user found for role ${asRole}`);
      }

      const exec = await executeTool({
        user: impersonated as any,
        requestId,
        toolName,
        args: args as any,
        teacherService: this.teacherService,
      });

      const log = await this.logs.findLatestByRequestId({ requestId });

      return ok(res, "OK", {
        requestId,
        toolName,
        result: exec.result,
        debug: {
          log,
        },
      });
    } catch (error: any) {
      const access = error instanceof AiAccessError ? error : null;
      const msg =
        typeof error?.message === "string" ? error.message : "TEST_TOOL_FAILED";

      const status = (() => {
        if (!access) return 500;
        if (access.code === "UNAUTHORIZED") return 401;
        if (access.code === "FORBIDDEN") return 403;
        if (access.code === "NOT_FOUND") return 404;
        return 400;
      })();

      console.error("AdminAiTestController.runTool failed:", error);
      return fail(res, status, msg);
    }
  };

  private async pickUser(params: {
    asRole: TestAsRole;
    userId: string | null;
  }): Promise<{
    id: string;
    email: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
    fullName: string | null;
    studentId: string | null;
    teacherId: string | null;
  } | null> {
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
      if (params.asRole === "ADMIN" && u.role !== "ADMIN") {
        return null;
      }

      return {
        id: u.id,
        email: u.email,
        role: params.asRole,
        fullName:
          params.asRole === "STUDENT"
            ? (u.student?.fullName ?? null)
            : params.asRole === "TEACHER"
              ? (u.teacher?.fullName ?? null)
              : null,
        studentId: u.studentId ?? null,
        teacherId: u.teacherId ?? null,
      };
    }

    const u = await prisma.user.findFirst({
      where:
        params.asRole === "STUDENT"
          ? { role: "STUDENT" }
          : params.asRole === "TEACHER"
            ? { role: "TEACHER" }
            : { role: "ADMIN" },
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
      role: params.asRole,
      fullName:
        params.asRole === "STUDENT"
          ? (u.student?.fullName ?? null)
          : params.asRole === "TEACHER"
            ? (u.teacher?.fullName ?? null)
            : null,
      studentId: u.studentId ?? null,
      teacherId: u.teacherId ?? null,
    };
  }
}
