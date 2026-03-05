import type { Request, Response } from "express";
import { AdminGroupService } from "../../services/admin/AdminGroupService";
import { created, fail, ok } from "../../utils/responses";

export class AdminGroupController {
  constructor(private readonly groupService: AdminGroupService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const groups = await this.groupService.list({ q, take, skip });
      return ok(res, "Groups fetched", groups);
    } catch {
      return fail(res, 500, "Failed to fetch groups");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const group = await this.groupService.getById(req.params.id);
      if (!group) {
        return fail(res, 404, "Group not found");
      }
      return ok(res, "Group fetched", group);
    } catch {
      return fail(res, 500, "Failed to fetch group");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return fail(res, 400, "name is required");
      }

      const group = await this.groupService.create({ name });
      return created(res, "Group created", group);
    } catch {
      return fail(res, 500, "Failed to create group");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { name } = req.body ?? {};

      const group = await this.groupService.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
      });

      return ok(res, "Group updated", group);
    } catch {
      return fail(res, 500, "Failed to update group");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.groupService.remove(req.params.id);
      return ok(res, "Group deleted");
    } catch {
      return fail(res, 500, "Failed to delete group");
    }
  };
}
