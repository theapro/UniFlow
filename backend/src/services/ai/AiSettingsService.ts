import { prisma } from "../../config/prisma";

export type AiSettingsDto = {
  key: string;
  isEnabled: boolean;
  systemPrompt: string;
  toolPlannerPrompt: string;
  defaultUserChatModelId: string | null;
  defaultAdminChatModelId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const SETTINGS_KEY = "default";

const DEFAULT_SYSTEM_PROMPT =
  "You are UniFlow AI. You must be accurate, privacy-preserving, and role-aware. " +
  "Never reveal data the user is not permitted to see. " +
  "Do not guess facts about a student (teacher, attendance, grades, schedule, group, subjects). " +
  "If the information exists in the database, retrieve it via tools and answer based on tool results. " +
  "If you lack required identifiers, ask a short clarifying question.";

const DEFAULT_TOOL_PLANNER_PROMPT =
  "You are a tool router for UniFlow. Your job is to select exactly one tool call (or ask a clarifying question) " +
  "based on the user message and the allowed tools. Output ONLY valid JSON.";

export class AiSettingsService {
  async getOrCreate(): Promise<AiSettingsDto> {
    const existing = await prisma.aiSettings.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (existing) {
      return {
        key: existing.key,
        isEnabled: existing.isEnabled,
        systemPrompt: existing.systemPrompt,
        toolPlannerPrompt: existing.toolPlannerPrompt,
        defaultUserChatModelId: existing.defaultUserChatModelId ?? null,
        defaultAdminChatModelId: existing.defaultAdminChatModelId ?? null,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const created = await prisma.aiSettings.create({
      data: {
        key: SETTINGS_KEY,
        isEnabled: true,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        toolPlannerPrompt: DEFAULT_TOOL_PLANNER_PROMPT,
      },
    });

    return {
      key: created.key,
      isEnabled: created.isEnabled,
      systemPrompt: created.systemPrompt,
      toolPlannerPrompt: created.toolPlannerPrompt,
      defaultUserChatModelId: created.defaultUserChatModelId ?? null,
      defaultAdminChatModelId: created.defaultAdminChatModelId ?? null,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async patch(
    patch: Partial<
      Pick<
        AiSettingsDto,
        | "isEnabled"
        | "systemPrompt"
        | "toolPlannerPrompt"
        | "defaultUserChatModelId"
        | "defaultAdminChatModelId"
      >
    >,
  ): Promise<AiSettingsDto> {
    const updated = await prisma.aiSettings.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        isEnabled: patch.isEnabled ?? true,
        systemPrompt: patch.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        toolPlannerPrompt:
          patch.toolPlannerPrompt ?? DEFAULT_TOOL_PLANNER_PROMPT,
        defaultUserChatModelId: patch.defaultUserChatModelId ?? null,
        defaultAdminChatModelId: patch.defaultAdminChatModelId ?? null,
      },
      update: {
        ...(patch.isEnabled !== undefined
          ? { isEnabled: Boolean(patch.isEnabled) }
          : {}),
        ...(patch.systemPrompt !== undefined
          ? { systemPrompt: String(patch.systemPrompt) }
          : {}),
        ...(patch.toolPlannerPrompt !== undefined
          ? { toolPlannerPrompt: String(patch.toolPlannerPrompt) }
          : {}),
        ...(patch.defaultUserChatModelId !== undefined
          ? { defaultUserChatModelId: patch.defaultUserChatModelId }
          : {}),
        ...(patch.defaultAdminChatModelId !== undefined
          ? { defaultAdminChatModelId: patch.defaultAdminChatModelId }
          : {}),
      },
    });

    return {
      key: updated.key,
      isEnabled: updated.isEnabled,
      systemPrompt: updated.systemPrompt,
      toolPlannerPrompt: updated.toolPlannerPrompt,
      defaultUserChatModelId: updated.defaultUserChatModelId ?? null,
      defaultAdminChatModelId: updated.defaultAdminChatModelId ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
