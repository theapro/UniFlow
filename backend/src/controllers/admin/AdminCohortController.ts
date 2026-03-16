import type { Request, Response } from "express";
import { created, fail, ok } from "../../utils/responses";
import { AdminCohortService } from "../../services/admin/AdminCohortService";

export class AdminCohortController {
  constructor(private readonly cohortService: AdminCohortService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const cohorts = await this.cohortService.list({ q, take, skip });
      return ok(res, "Cohorts fetched", cohorts);
    } catch {
      return fail(res, 500, "Failed to fetch cohorts");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const cohort = await this.cohortService.getById(req.params.id);
      if (!cohort) return fail(res, 404, "Cohort not found");
      return ok(res, "Cohort fetched", cohort);
    } catch {
      return fail(res, 500, "Failed to fetch cohort");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { code, sortOrder, year } = req.body ?? {};
      if (!code || typeof code !== "string" || !code.trim()) {
        return fail(res, 400, "code is required");
      }

      const cohort = await this.cohortService.create({
        code: code.trim(),
        sortOrder:
          sortOrder === undefined || sortOrder === null
            ? undefined
            : Number(sortOrder),
        year: year === undefined || year === null ? undefined : Number(year),
      });

      return created(res, "Cohort created", cohort);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to create cohort";
      return fail(res, 500, msg);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { code, sortOrder, year } = req.body ?? {};
      if (code !== undefined && (typeof code !== "string" || !code.trim())) {
        return fail(res, 400, "code must be a non-empty string");
      }

      const cohort = await this.cohortService.update(req.params.id, {
        ...(code !== undefined ? { code: code.trim() } : {}),
        ...(sortOrder !== undefined
          ? { sortOrder: sortOrder === null ? null : Number(sortOrder) }
          : {}),
        ...(year !== undefined
          ? { year: year === null ? null : Number(year) }
          : {}),
      });

      return ok(res, "Cohort updated", cohort);
    } catch (err: any) {
      return fail(res, 500, err?.message ?? "Failed to update cohort");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.cohortService.remove(req.params.id);
      return ok(res, "Cohort deleted");
    } catch (err: any) {
      if (err?.message === "COHORT_HAS_GROUPS") {
        return fail(res, 409, "Cohort has groups; remove/move them first");
      }
      return fail(res, 500, err?.message ?? "Failed to delete cohort");
    }
  };
}
