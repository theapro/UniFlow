import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { fail, ok } from "../../utils/responses";
import {
  AI_TOOL_NAMES,
  type AiToolName,
} from "../../services/ai-tools/toolNames";
import { executeTool } from "../../ai/tools/executeTool";
import { TeacherService } from "../../services/user/TeacherService";
import {
  createAiDebugRuntime,
  finalizeAiDebugTrace,
  runWithAiDebugRuntime,
} from "../../services/ai-debug/aiDebugTrace";
import {
  debugScheduleRaw,
  debugStudentFlow,
  debugTeacherRelation,
} from "../../services/ai-debug/debugQueries";

type AsRole = "STUDENT" | "TEACHER" | "ADMIN";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class AiDebugRunController {
  private readonly teacherService = new TeacherService();

  run = async (req: Request, res: Response) => {
    const startedAtMs = Date.now();

    try {
      const rawTool = (req.body?.tool ?? req.body?.toolName ?? "") as unknown;
      const tool = String(rawTool ?? "").trim();
      if (!tool) return fail(res, 400, "tool is required");

      // Special debug queries (not AI tools)
      if (tool === "debugScheduleRaw") {
        const requestId = `debug_run_${randomUUID()}`;
        const runtime = createAiDebugRuntime({
          message: "debugScheduleRaw",
          classification: { type: "tool", confidence: 1 },
          tool: { selected: tool, reason: "Force debug query" },
          context: {
            userId: req.user?.id ?? null,
            role: req.user?.role ?? null,
            studentId: (req.user as any)?.studentId ?? null,
            teacherId: (req.user as any)?.teacherId ?? null,
            groupId: null,
            sessionId: null,
            requestId,
          },
          startedAt: new Date(startedAtMs),
        });

        runtime.setToolName(tool);
        const result = await runWithAiDebugRuntime(runtime, debugScheduleRaw);
        runtime.setToolName(null);
        finalizeAiDebugTrace({
          runtime,
          startedAtMs,
          endedAtMs: Date.now(),
          finalResponse: "",
        });

        return ok(res, "OK", {
          requestId,
          tool,
          result,
          debugTrace: runtime.trace,
        });
      }

      if (tool === "debugStudentFlow") {
        const requestId = `debug_run_${randomUUID()}`;
        const input = (req.body?.input ?? req.body?.args ?? {}) as unknown;
        if (!isObject(input)) return fail(res, 400, "input must be an object");
        if (typeof input.studentId !== "string") {
          return fail(res, 400, "input.studentId is required");
        }

        const runtime = createAiDebugRuntime({
          message: "debugStudentFlow",
          classification: { type: "tool", confidence: 1 },
          tool: { selected: tool, reason: "Force debug query" },
          context: {
            userId: req.user?.id ?? null,
            role: req.user?.role ?? null,
            studentId: String(input.studentId),
            teacherId: (req.user as any)?.teacherId ?? null,
            groupId: null,
            sessionId: null,
            requestId,
          },
          startedAt: new Date(startedAtMs),
        });

        runtime.setToolName(tool);
        const result = await runWithAiDebugRuntime(runtime, () =>
          debugStudentFlow({ studentId: String(input.studentId) }),
        );
        runtime.setToolName(null);
        finalizeAiDebugTrace({
          runtime,
          startedAtMs,
          endedAtMs: Date.now(),
          finalResponse: "",
        });

        return ok(res, "OK", {
          requestId,
          tool,
          result,
          debugTrace: runtime.trace,
        });
      }

      if (tool === "debugTeacherRelation") {
        const requestId = `debug_run_${randomUUID()}`;
        const runtime = createAiDebugRuntime({
          message: "debugTeacherRelation",
          classification: { type: "tool", confidence: 1 },
          tool: { selected: tool, reason: "Force debug query" },
          context: {
            userId: req.user?.id ?? null,
            role: req.user?.role ?? null,
            studentId: (req.user as any)?.studentId ?? null,
            teacherId: (req.user as any)?.teacherId ?? null,
            groupId: null,
            sessionId: null,
            requestId,
          },
          startedAt: new Date(startedAtMs),
        });

        runtime.setToolName(tool);
        const result = await runWithAiDebugRuntime(
          runtime,
          debugTeacherRelation,
        );
        runtime.setToolName(null);
        finalizeAiDebugTrace({
          runtime,
          startedAtMs,
          endedAtMs: Date.now(),
          finalResponse: "",
        });

        return ok(res, "OK", {
          requestId,
          tool,
          result,
          debugTrace: runtime.trace,
        });
      }

      // Normal tool execution
      const toolName = tool as AiToolName;
      if (!(AI_TOOL_NAMES as readonly string[]).includes(toolName)) {
        return fail(res, 400, "Unknown tool");
      }

      const argsRaw = (req.body?.input ?? req.body?.args ?? {}) as unknown;
      if (!isObject(argsRaw)) return fail(res, 400, "input must be an object");

      const asRole = (req.body?.asRole ?? "ADMIN") as unknown;
      if (asRole !== "STUDENT" && asRole !== "TEACHER" && asRole !== "ADMIN") {
        return fail(res, 400, "asRole must be STUDENT, TEACHER, or ADMIN");
      }

      const userId =
        typeof req.body?.userId === "string" ? req.body.userId : null;

      const impersonated = await this.pickUser({
        asRole: asRole as AsRole,
        userId,
      });
      if (!impersonated) {
        return fail(res, 404, `No user found for role ${asRole}`);
      }

      const requestId = `debug_run_${randomUUID()}`;

      const runtime = createAiDebugRuntime({
        message: `debug-run:${toolName}`,
        classification: { type: "tool", confidence: 1 },
        tool: { selected: toolName, reason: "Force tool run (no AI)" },
        context: {
          userId: impersonated.id,
          role: impersonated.role,
          studentId: impersonated.studentId ?? null,
          teacherId: impersonated.teacherId ?? null,
          groupId: null,
          sessionId: null,
          requestId,
        },
        startedAt: new Date(startedAtMs),
      });

      runtime.setToolName(toolName);
      const exec = await runWithAiDebugRuntime(runtime, async () => {
        return executeTool({
          user: impersonated as any,
          requestId,
          toolName,
          args: argsRaw,
          teacherService: this.teacherService,
        });
      });
      runtime.setToolName(null);

      const endedAtMs = Date.now();
      finalizeAiDebugTrace({
        runtime,
        startedAtMs,
        endedAtMs,
        finalResponse: "",
      });

      return ok(res, "OK", {
        requestId,
        toolName,
        args: argsRaw,
        result: exec.result,
        debugTrace: runtime.trace,
      });
    } catch (error: any) {
      console.error("AiDebugRunController.run failed:", error);
      return fail(
        res,
        500,
        typeof error?.message === "string" ? error.message : "DEBUG_RUN_FAILED",
      );
    } finally {
      // Keep prisma import used (and help avoid edge-case ts tree-shaking)
      void prisma;
    }
  };

  private async pickUser(params: {
    asRole: AsRole;
    userId: string | null;
  }): Promise<{
    id: string;
    email: string;
    role: "STUDENT" | "TEACHER" | "ADMIN";
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
        },
      });

      if (!u) return null;
      if (params.asRole !== u.role) return null;

      return {
        id: u.id,
        email: u.email,
        role: params.asRole,
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
      },
    });

    if (!u) return null;

    return {
      id: u.id,
      email: u.email,
      role: params.asRole,
      studentId: u.studentId ?? null,
      teacherId: u.teacherId ?? null,
    };
  }
}
