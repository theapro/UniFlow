import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma";

export type AccessControlMatrixDto = {
  roles: Role[];
  permissions: string[];
  rolePermissions: Record<string, string[]>;
};

function editableRoles(): Role[] {
  return [Role.TEACHER, Role.STAFF, Role.MANAGER];
}

export class AdminAccessControlService {
  async getMatrix(): Promise<AccessControlMatrixDto> {
    const roles = editableRoles();

    const [permissions, rolePermissions] = await Promise.all([
      prisma.permission.findMany({
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      prisma.rolePermission.findMany({
        where: { role: { in: roles } },
        select: { role: true, permission: true },
      }),
    ]);

    const roleMap: Record<string, string[]> = {};
    for (const role of roles) roleMap[role] = [];

    for (const rp of rolePermissions) {
      if (!roleMap[rp.role]) roleMap[rp.role] = [];
      roleMap[rp.role].push(rp.permission);
    }

    for (const r of Object.keys(roleMap)) {
      roleMap[r] = Array.from(new Set(roleMap[r])).sort();
    }

    return {
      roles,
      permissions: permissions.map((p) => p.name),
      rolePermissions: roleMap,
    };
  }

  async togglePermission(params: {
    role: Role;
    permission: string;
    enabled: boolean;
  }): Promise<{ role: Role; permissions: string[] }> {
    if (!editableRoles().includes(params.role)) {
      throw new Error("ROLE_NOT_EDITABLE");
    }

    const permission = String(params.permission ?? "").trim();
    if (!permission) {
      throw new Error("PERMISSION_REQUIRED");
    }

    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: { name: permission },
      select: { id: true },
    });

    if (params.enabled) {
      await prisma.rolePermission.upsert({
        where: {
          role_permission: {
            role: params.role,
            permission,
          },
        },
        update: {},
        create: {
          role: params.role,
          permission,
        },
        select: { id: true },
      });
    } else {
      await prisma.rolePermission.deleteMany({
        where: { role: params.role, permission },
      });
    }

    const updated = await prisma.rolePermission.findMany({
      where: { role: params.role },
      select: { permission: true },
      orderBy: { permission: "asc" },
    });

    return {
      role: params.role,
      permissions: updated.map((r) => r.permission),
    };
  }
}
