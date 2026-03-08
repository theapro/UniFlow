import type { Request, Response } from "express";
import { AdminSubjectService } from "../../services/admin/AdminSubjectService";
import { TeachersSheetsSyncService } from "../../services/teachers-sheets/TeachersSheetsSyncService";
import { created, fail, ok } from "../../utils/responses";

export class AdminSubjectController {
  private teachersSheetsSyncService: TeachersSheetsSyncService | null = null;

  constructor(private readonly subjectService: AdminSubjectService) {}

  setSyncService(syncService: TeachersSheetsSyncService) {
    this.teachersSheetsSyncService = syncService;
  }

  private async triggerSync() {
    if (this.teachersSheetsSyncService) {
      // Run in background
      this.teachersSheetsSyncService.syncDbToSheets().catch((err) => {
        console.error(
          "Failed to trigger DB to Sheets sync after subject change:",
          err,
        );
      });
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const subjects = await this.subjectService.list({ q, take, skip });
      return ok(res, "Subjects fetched", subjects);
    } catch (err) {
      console.error("[AdminSubjectController.list] Failed to fetch subjects", {
        query: req.query,
        user: (req as any).user,
        error: err,
      });
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
    } catch (err) {
      console.error(
        "[AdminSubjectController.getById] Failed to fetch subject",
        {
          params: req.params,
          user: (req as any).user,
          error: err,
        },
      );
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

      // Trigger sync to ensure new tab is created in Sheets if needed
      await this.triggerSync();

      return created(res, "Subject created", subject);
    } catch (err: any) {
      console.error(
        "[AdminSubjectController.create] Failed to create subject",
        {
          body: req.body,
          user: (req as any).user,
          error: err,
        },
      );
      if (err.code === "P2002") {
        return fail(res, 400, "Subject with this name already exists");
      }
      return fail(res, 500, "Failed to create subject");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { name, code } = req.body ?? {};

      const before = await this.subjectService.getById(req.params.id);

      const subject = await this.subjectService.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
      });

      // If subject name changed, keep Sheets tab name in sync
      if (
        this.teachersSheetsSyncService &&
        before?.name &&
        subject?.name &&
        before.name !== subject.name
      ) {
        this.teachersSheetsSyncService
          .renameSubjectTab({ fromTitle: before.name, toTitle: subject.name })
          .catch((err) => {
            console.error(
              "Failed to rename Sheets tab after subject rename:",
              err,
            );
          });
      }

      // Trigger sync to update tab names if subject name changed
      await this.triggerSync();

      return ok(res, "Subject updated", subject);
    } catch (err: any) {
      console.error(
        "[AdminSubjectController.update] Failed to update subject",
        {
          params: req.params,
          body: req.body,
          user: (req as any).user,
          error: err,
        },
      );
      if (err.code === "P2002") {
        return fail(res, 400, "Subject with this name already exists");
      }
      return fail(res, 500, "Failed to update subject");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.subjectService.remove(req.params.id);

      // No need to trigger deep sync here usually, as we don't delete tabs from sheets automatically for safety

      return ok(res, "Subject deleted");
    } catch (err: any) {
      console.error(
        "[AdminSubjectController.remove] Failed to delete subject",
        {
          params: req.params,
          user: (req as any).user,
          error: err,
        },
      );
      return fail(res, 500, "Failed to delete subject: " + err.message);
    }
  };
}
