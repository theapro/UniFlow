import type { Request, Response } from "express";
import { fail, ok } from "../../utils/responses";
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
      return ok(res, "Department groups fetched", rows);
    } catch {
      return fail(res, 500, "Failed to fetch department groups");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const row = await this.service.getById(req.params.id);
      if (!row) return fail(res, 404, "Department group not found");
      return ok(res, "Department group fetched", row);
    } catch {
      return fail(res, 500, "Failed to fetch department group");
    }
  };

  create = async (req: Request, res: Response) => {
    return fail(
      res,
      403,
      "Departments are system-defined and cannot be created via API",
    );
  };

  update = async (req: Request, res: Response) => {
    return fail(
      res,
      403,
      "Departments are system-defined and cannot be edited via API",
    );
  };

  remove = async (req: Request, res: Response) => {
    return fail(
      res,
      403,
      "Departments are system-defined and cannot be deleted via API",
    );
  };
}
