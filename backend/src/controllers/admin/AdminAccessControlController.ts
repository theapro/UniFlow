import type { Request, Response } from "express";
import { Role } from "@prisma/client";
import { ok, fail } from "../../utils/responses";
import { AdminAccessControlService } from "../../services/admin/AdminAccessControlService";

function parseRole(value: unknown): Role | null {
  if (value === Role.TEACHER) return Role.TEACHER;
  if (value === Role.STAFF) return Role.STAFF;
  if (value === Role.MANAGER) return Role.MANAGER;
  return null;
}

export class AdminAccessControlController {
  constructor(private readonly service: AdminAccessControlService) {}

  getMatrix = async (_req: Request, res: Response) => {
    try {
      const result = await this.service.getMatrix();
      return ok(res, "OK", result);
    } catch (e: any) {
      return fail(res, 500, e?.message || "Failed to load access control");
    }
  };

  toggle = async (req: Request, res: Response) => {
    try {
      const role = parseRole(req.body?.role);
      const permission = req.body?.permission;
      const enabled = Boolean(req.body?.enabled);

      if (!role) {
        return fail(res, 400, "role must be one of: TEACHER, STAFF, MANAGER");
      }
      if (typeof permission !== "string" || permission.trim().length === 0) {
        return fail(res, 400, "permission is required");
      }

      const result = await this.service.togglePermission({
        role,
        permission,
        enabled,
      });

      return ok(res, "OK", result);
    } catch (e: any) {
      if (e?.message === "ROLE_NOT_EDITABLE") {
        return fail(res, 400, "This role cannot be edited");
      }
      if (e?.message === "PERMISSION_REQUIRED") {
        return fail(res, 400, "permission is required");
      }

      return fail(res, 500, e?.message || "Failed to update role permissions");
    }
  };
}
