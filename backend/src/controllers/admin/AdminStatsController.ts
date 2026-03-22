import type { Request, Response } from "express";
import { ok, fail } from "../../utils/responses";
import {
  AdminStatsService,
  type StatsRange,
} from "../../services/admin/AdminStatsService";
import { Role } from "@prisma/client";

function parseRange(value: unknown): StatsRange {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

function parseRole(value: unknown): Role | null {
  if (value === Role.STUDENT) return Role.STUDENT;
  if (value === Role.TEACHER) return Role.TEACHER;
  if (value === Role.STAFF) return Role.STAFF;
  if (value === Role.MANAGER) return Role.MANAGER;
  if (value === Role.ADMIN) return Role.ADMIN;
  return null;
}

export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  summary = async (_req: Request, res: Response) => {
    try {
      const result = await this.statsService.getSummary();
      return ok(res, "OK", result);
    } catch {
      return fail(res, 500, "Failed to fetch summary stats");
    }
  };

  userActivity = async (req: Request, res: Response) => {
    try {
      const range = parseRange(req.query.range);
      const result = await this.statsService.getUserActivity(range);
      return ok(res, "OK", result);
    } catch {
      return fail(res, 500, "Failed to fetch user activity stats");
    }
  };

  loginStatus = async (req: Request, res: Response) => {
    try {
      const role = parseRole(req.query.role);
      if (!role) {
        return fail(
          res,
          400,
          "role must be one of: STUDENT, TEACHER, STAFF, MANAGER, ADMIN",
        );
      }
      const result = await this.statsService.getLoginStatus(role);
      return ok(res, "OK", result);
    } catch {
      return fail(res, 500, "Failed to fetch login status");
    }
  };
}
