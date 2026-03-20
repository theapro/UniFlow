import { AiToolConfigService } from "../../services/ai/AiToolConfigService";
import { AiUsageLogService } from "../../services/ai/AiUsageLogService";
import type { TeacherService } from "../../services/user/TeacherService";
import { AiAccessError } from "./access";
import { listToolDefinitions, runTool } from "./toolRegistry";
import type { AiToolName } from "../../services/ai-tools/toolNames";

export async function executeTool(params: {
  user: Express.User;
  requestId: string | null;
  toolName: AiToolName;
  args: Record<string, unknown>;
  teacherService: TeacherService;
}): Promise<{ result: unknown }> {
  const startedAt = Date.now();
  const toolConfig = new AiToolConfigService();
  const logs = new AiUsageLogService();

  const def = listToolDefinitions().find((t) => t.name === params.toolName);
  if (!def) throw new AiAccessError("BAD_REQUEST", "Unknown tool");

  if (!def.allowedRoles.includes(params.user.role)) {
    throw new AiAccessError("FORBIDDEN", "Tool not allowed for this role");
  }

  const allowedByConfig = await toolConfig.isToolAllowed({
    name: params.toolName,
    role: params.user.role,
  });

  if (!allowedByConfig) {
    throw new AiAccessError("FORBIDDEN", "TOOL_NOT_ALLOWED");
  }

  const logRow = await logs.logStart({
    userId: params.user.id ?? null,
    role: params.user.role ?? null,
    requestId: params.requestId,
    provider: null,
    model: null,
    userMessage: `TOOL:${params.toolName}`,
    meta: {
      tool: params.toolName,
    },
  });

  try {
    const result = await runTool({
      name: params.toolName,
      user: params.user,
      args: params.args,
      teacherService: params.teacherService,
    });

    await logs.logFinish({
      id: logRow.id,
      toolName: params.toolName,
      toolArgs: params.args as any,
      assistantMessage: null,
      status: "OK",
      error: null,
      ms: Date.now() - startedAt,
      meta: {
        role: params.user.role,
      },
    });

    return { result };
  } catch (error: any) {
    const msg =
      typeof error?.message === "string" ? error.message : "TOOL_ERROR";

    await logs.logFinish({
      id: logRow.id,
      toolName: params.toolName,
      toolArgs: params.args as any,
      assistantMessage: null,
      status: "ERROR",
      error: msg,
      ms: Date.now() - startedAt,
    });

    if (error instanceof AiAccessError) throw error;

    throw new Error(msg);
  }
}
