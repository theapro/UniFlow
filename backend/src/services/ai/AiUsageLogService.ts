import { prisma } from "../../config/prisma";
import type { AiToolName } from "../ai-tools/toolNames";

export class AiUsageLogService {
  async logStart(params: {
    userId: string | null;
    role: any;
    requestId: string | null;
    provider: string | null;
    model: string | null;
    userMessage: string;
    meta?: any;
  }): Promise<{ id: string }> {
    const row = await prisma.aiUsageLog.create({
      data: {
        userId: params.userId,
        role: params.role as any,
        requestId: params.requestId,
        provider: params.provider,
        model: params.model,
        userMessage: params.userMessage,
        status: "STARTED",
        meta: params.meta ?? null,
      },
      select: { id: true },
    });

    return row;
  }

  async logFinish(params: {
    id: string;
    toolName: AiToolName | null;
    toolArgs: any;
    assistantMessage: string | null;
    status: "OK" | "ERROR";
    error: string | null;
    ms: number | null;
    meta?: any;
  }): Promise<void> {
    await prisma.aiUsageLog.update({
      where: { id: params.id },
      data: {
        toolName: params.toolName,
        toolArgs: params.toolArgs ?? null,
        assistantMessage: params.assistantMessage,
        status: params.status,
        error: params.error,
        ms: params.ms,
        ...(params.meta !== undefined ? { meta: params.meta } : {}),
      },
      select: { id: true },
    });
  }

  async list(params: { take?: number; cursor?: string | null }) {
    const take = Math.min(Math.max(params.take ?? 50, 1), 200);

    const rows = await prisma.aiUsageLog.findMany({
      take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        role: true,
        requestId: true,
        provider: true,
        model: true,
        toolName: true,
        status: true,
        error: true,
        ms: true,
        createdAt: true,
      },
    });

    return {
      items: rows,
      nextCursor: rows.length > 0 ? rows[rows.length - 1].id : null,
    };
  }

  async findLatestByRequestId(params: { requestId: string }) {
    const requestId = String(params.requestId ?? "").trim();
    if (!requestId) return null;

    return prisma.aiUsageLog.findFirst({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        role: true,
        requestId: true,
        provider: true,
        model: true,
        toolName: true,
        toolArgs: true,
        userMessage: true,
        assistantMessage: true,
        status: true,
        error: true,
        ms: true,
        meta: true,
        createdAt: true,
      },
    });
  }
}
