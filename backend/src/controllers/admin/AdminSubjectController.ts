import type { Request, Response } from "express";
import { AdminSubjectService } from "../../services/admin/AdminSubjectService";
import { created, fail, ok } from "../../utils/responses";

export class AdminSubjectController {
  constructor(private readonly subjectService: AdminSubjectService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const subjects = await this.subjectService.list({ q, take, skip });
      return ok(res, "Subjects fetched", subjects);
    } catch {
      return fail(res, 500, "Failed to fetch subjects");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const subject = await this.subjectService.getById(req.params.id);
      if (!subject) {
        return fail(res, 404, "Subject not found");
      }
      return ok(res, "Subject fetched", subject);
    } catch {
      return fail(res, 500, "Failed to fetch subject");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name, code } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return fail(res, 400, "name is required");
      }

      const subject = await this.subjectService.create({
        name,
        code: typeof code === "string" ? code : (code ?? null),
      });

      return created(res, "Subject created", subject);
    } catch {
      return fail(res, 500, "Failed to create subject");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { name, code } = req.body ?? {};

      const subject = await this.subjectService.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
      });

      return ok(res, "Subject updated", subject);
    } catch {
      return fail(res, 500, "Failed to update subject");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.subjectService.remove(req.params.id);
      return ok(res, "Subject deleted");
    } catch {
      return fail(res, 500, "Failed to delete subject");
    }
  };
}
