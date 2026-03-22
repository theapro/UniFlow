import { AiModality, Role } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";

export type AiModelDto = {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  modality: AiModality;
  isEnabled: boolean;
  enabledForUsers: boolean;
  enabledForAdmins: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

function isAdminRole(role: Role): boolean {
  return role === Role.ADMIN;
}

export class AiModelService {
  async listAll(): Promise<AiModelDto[]> {
    return prisma.aiModel.findMany({
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
  }

  async listAllowedForRole(params: {
    role: Role;
    modality?: AiModality;
  }): Promise<AiModelDto[]> {
    const modality = params.modality ?? AiModality.CHAT;
    const forAdmins = isAdminRole(params.role);

    return prisma.aiModel.findMany({
      where: {
        isEnabled: true,
        modality,
        ...(forAdmins ? { enabledForAdmins: true } : { enabledForUsers: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
  }

  /**
   * Resolves a Groq model name for chat based on admin policy.
   * - If `requestedModel` is present, it must be enabled for the role.
   * - Else, returns the first allowed CHAT model.
   * - If DB has no models yet, falls back to GROQ_MODEL/env default.
   */
  async resolveChatModel(params: {
    role: Role;
    requestedModel?: string;
  }): Promise<{ model: string; source: "requested" | "default" | "env" }> {
    const requestedModel = params.requestedModel?.trim();
    if (requestedModel) {
      const allowed = await prisma.aiModel.findFirst({
        where: {
          provider: "groq",
          model: requestedModel,
          modality: AiModality.CHAT,
          isEnabled: true,
          ...(isAdminRole(params.role)
            ? { enabledForAdmins: true }
            : { enabledForUsers: true }),
        },
        select: { model: true },
      });

      if (!allowed) {
        const error = new Error("MODEL_NOT_ALLOWED");
        (error as any).code = "MODEL_NOT_ALLOWED";
        throw error;
      }

      return { model: requestedModel, source: "requested" };
    }

    const allowed = await this.listAllowedForRole({
      role: params.role,
      modality: AiModality.CHAT,
    });

    if (allowed.length > 0) {
      return { model: allowed[0].model, source: "default" };
    }

    return {
      model: env.groqModel ?? process.env.GROQ_MODEL ?? "qwen/qwen3-32b",
      source: "env",
    };
  }

  async updateModel(
    id: string,
    patch: Partial<
      Pick<
        AiModelDto,
        | "displayName"
        | "isEnabled"
        | "enabledForUsers"
        | "enabledForAdmins"
        | "sortOrder"
      >
    >,
  ): Promise<AiModelDto> {
    return prisma.aiModel.update({
      where: { id },
      data: {
        ...(patch.displayName !== undefined
          ? { displayName: String(patch.displayName).slice(0, 120) }
          : {}),
        ...(patch.isEnabled !== undefined
          ? { isEnabled: Boolean(patch.isEnabled) }
          : {}),
        ...(patch.enabledForUsers !== undefined
          ? { enabledForUsers: Boolean(patch.enabledForUsers) }
          : {}),
        ...(patch.enabledForAdmins !== undefined
          ? { enabledForAdmins: Boolean(patch.enabledForAdmins) }
          : {}),
        ...(patch.sortOrder !== undefined
          ? { sortOrder: Number(patch.sortOrder) }
          : {}),
      },
    });
  }
}
