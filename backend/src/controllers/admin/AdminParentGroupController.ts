import type { Request, Response } from "express";
import { created, fail, ok } from "../../utils/responses";
import { AdminParentGroupService } from "../../services/admin/AdminParentGroupService";

export class AdminParentGroupController {
  constructor(private readonly service: AdminParentGroupService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const rows = await this.service.list({ q, take, skip });
      return ok(res, "Parent groups fetched", rows);
    } catch {
      return fail(res, 500, "Failed to fetch parent groups");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const row = await this.service.getById(req.params.id);
      if (!row) return fail(res, 404, "Parent group not found");
      return ok(res, "Parent group fetched", row);
    } catch {
      return fail(res, 500, "Failed to fetch parent group");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const name = (req.body?.name ?? "") as unknown;
      if (typeof name !== "string" || name.trim().length === 0) {
        return fail(res, 400, "name is required");
      }

      const row = await this.service.create({ name: name.trim() });
      return created(res, "Parent group created", row);
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" ? e.message : "Failed to create";
      return fail(res, 500, msg);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const name = req.body?.name as unknown;
      if (name !== undefined && typeof name !== "string") {
        return fail(res, 400, "name must be a string");
      }

      const row = await this.service.update(req.params.id, {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
      });

      return ok(res, "Parent group updated", row);
    } catch {
      return fail(res, 500, "Failed to update parent group");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.service.remove(req.params.id);
      return ok(res, "Parent group deleted", true);
    } catch {
      return fail(res, 500, "Failed to delete parent group");
    }
  };
}
