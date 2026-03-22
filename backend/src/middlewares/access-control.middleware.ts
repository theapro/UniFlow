import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { fail } from "../utils/responses";

async function resolvePermissionsForRole(role: Role): Promise<string[]> {
  if (role === Role.ADMIN) {
    const all = await prisma.permission.findMany({ select: { name: true } });
    return all.map((p) => p.name);
  }

  const rows = await prisma.rolePermission.findMany({
    where: { role },
    select: { permission: true },
  });

  return rows.map((r) => r.permission);
}

export function requireRole(allowed: Role | Role[]) {
  const allowedList = Array.isArray(allowed) ? allowed : [allowed];

  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return fail(res, 401, "Unauthorized");

    if (!allowedList.includes(user.role)) {
      return fail(res, 403, "Forbidden");
    }

    return next();
  };
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return fail(res, 401, "Unauthorized");

    // Admin bypass (admin panel has full control)
    if (user.role === Role.ADMIN) return next();

    // Prefer permissions already attached by authMiddleware.
    const fromReq = Array.isArray((user as any).permissions)
      ? ((user as any).permissions as string[])
      : null;

    const permissions = fromReq ?? (await resolvePermissionsForRole(user.role));

    if (!permissions.includes(permission)) {
      return fail(res, 403, "Forbidden");
    }

    // Ensure downstream can reuse without extra DB hit
    (req.user as any).permissions = permissions;

    return next();
  };
}
