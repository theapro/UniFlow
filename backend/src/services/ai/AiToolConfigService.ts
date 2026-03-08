import { UserRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AI_TOOL_NAMES, type AiToolName } from "../ai-tools/toolNames";

export type AiToolConfigDto = {
  name: AiToolName;
  isEnabled: boolean;
  enabledForStudents: boolean;
  enabledForTeachers: boolean;
  enabledForAdmins: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function roleAllowed(cfg: AiToolConfigDto, role: UserRole): boolean {
  if (!cfg.isEnabled) return false;
  if (role === UserRole.ADMIN) return cfg.enabledForAdmins;
  if (role === UserRole.TEACHER) return cfg.enabledForTeachers;
  return cfg.enabledForStudents;
}

export class AiToolConfigService {
  async ensureDefaults(): Promise<void> {
    const existing = await prisma.aiToolConfig.findMany({
      select: { name: true },
    });
    const existingSet = new Set(existing.map((e) => e.name));

    const missing = AI_TOOL_NAMES.filter((n) => !existingSet.has(n));
    if (missing.length === 0) return;

    await prisma.aiToolConfig.createMany({
      data: missing.map((name) => ({
        name,
        isEnabled: true,
        enabledForStudents: name.startsWith("getStudent"),
        enabledForTeachers:
          name.startsWith("getStudent") || name.startsWith("getGroup"),
        enabledForAdmins: true,
      })),
      skipDuplicates: true,
    });
  }

  async listAll(): Promise<AiToolConfigDto[]> {
    await this.ensureDefaults();
    const rows = await prisma.aiToolConfig.findMany({
      orderBy: { name: "asc" },
    });

    return rows.map((r) => ({
      name: r.name as AiToolName,
      isEnabled: r.isEnabled,
      enabledForStudents: r.enabledForStudents,
      enabledForTeachers: r.enabledForTeachers,
      enabledForAdmins: r.enabledForAdmins,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async listAllowed(role: UserRole): Promise<AiToolConfigDto[]> {
    const all = await this.listAll();
    return all.filter((c) => roleAllowed(c, role));
  }

  async update(
    name: string,
    patch: Partial<Omit<AiToolConfigDto, "name" | "createdAt" | "updatedAt">>,
  ): Promise<AiToolConfigDto> {
    const toolName = name as AiToolName;
    if (!(AI_TOOL_NAMES as readonly string[]).includes(toolName)) {
      throw new Error("UNKNOWN_TOOL");
    }

    const updated = await prisma.aiToolConfig.upsert({
      where: { name: toolName },
      create: {
        name: toolName,
        isEnabled: patch.isEnabled ?? true,
        enabledForStudents:
          patch.enabledForStudents ?? toolName.startsWith("getStudent"),
        enabledForTeachers:
          patch.enabledForTeachers ??
          (toolName.startsWith("getStudent") ||
            toolName.startsWith("getGroup")),
        enabledForAdmins: patch.enabledForAdmins ?? true,
      },
      update: {
        ...(patch.isEnabled !== undefined
          ? { isEnabled: Boolean(patch.isEnabled) }
          : {}),
        ...(patch.enabledForStudents !== undefined
          ? { enabledForStudents: Boolean(patch.enabledForStudents) }
          : {}),
        ...(patch.enabledForTeachers !== undefined
          ? { enabledForTeachers: Boolean(patch.enabledForTeachers) }
          : {}),
        ...(patch.enabledForAdmins !== undefined
          ? { enabledForAdmins: Boolean(patch.enabledForAdmins) }
          : {}),
      },
    });

    return {
      name: updated.name as AiToolName,
      isEnabled: updated.isEnabled,
      enabledForStudents: updated.enabledForStudents,
      enabledForTeachers: updated.enabledForTeachers,
      enabledForAdmins: updated.enabledForAdmins,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async isToolAllowed(params: {
    name: AiToolName;
    role: UserRole;
  }): Promise<boolean> {
    await this.ensureDefaults();
    const cfg = await prisma.aiToolConfig.findUnique({
      where: { name: params.name },
    });

    if (!cfg) return false;

    const dto: AiToolConfigDto = {
      name: cfg.name as AiToolName,
      isEnabled: cfg.isEnabled,
      enabledForStudents: cfg.enabledForStudents,
      enabledForTeachers: cfg.enabledForTeachers,
      enabledForAdmins: cfg.enabledForAdmins,
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
    };

    return roleAllowed(dto, params.role);
  }
}
