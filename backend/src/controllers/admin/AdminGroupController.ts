import type { Request, Response } from "express";
import { AdminGroupService } from "../../services/admin/AdminGroupService";
import { created, fail, ok } from "../../utils/responses";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { StudentsSheetsGroupsService } from "../../services/students-sheets/StudentsSheetsGroupsService";

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

      // Best-effort: create a matching Google Sheets tab.
      if (env.studentsSheetsEnabled) {
        try {
          const sheetsGroups = new StudentsSheetsGroupsService(prisma);
          await sheetsGroups.ensureGroupTabExists(group.name);
        } catch (e) {
          console.warn(
            "[AdminGroupController] failed to ensure Sheets tab for group",
            (e as any)?.message ?? String(e),
          );
        }
      }
      return created(res, "Group created", group);
    } catch {
      return fail(res, 500, "Failed to create group");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { name, parentGroupId } = req.body ?? {};

      if (
        parentGroupId !== undefined &&
        parentGroupId !== null &&
        typeof parentGroupId !== "string"
      ) {
        return fail(res, 400, "parentGroupId must be a string or null");
      }

      const normalizedParentGroupId =
        parentGroupId === ""
          ? null
          : (parentGroupId as string | null | undefined);

      const prev =
        typeof name === "string"
          ? await this.groupService.getById(req.params.id)
          : null;

      const group = await this.groupService.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(normalizedParentGroupId !== undefined
          ? { parentGroupId: normalizedParentGroupId }
          : {}),
      });

      // Best-effort: rename/create Sheets tab if group name changed.
      if (env.studentsSheetsEnabled && typeof name === "string") {
        const fromName = typeof prev?.name === "string" ? prev.name : null;
        if (fromName && fromName !== group.name) {
          try {
            const sheetsGroups = new StudentsSheetsGroupsService(prisma);
            await sheetsGroups.renameGroupTab({
              fromName,
              toName: group.name,
            });
          } catch (e) {
            console.warn(
              "[AdminGroupController] failed to rename Sheets tab for group",
              (e as any)?.message ?? String(e),
            );
          }
        } else if (!fromName) {
          try {
            const sheetsGroups = new StudentsSheetsGroupsService(prisma);
            await sheetsGroups.ensureGroupTabExists(group.name);
          } catch {
            // ignore
          }
        }
      }

      return ok(res, "Group updated", group);
    } catch {
      return fail(res, 500, "Failed to update group");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      const deleteSheetTab =
        req.query.deleteSheetTab === "1" || req.query.deleteSheetTab === "true";

      const prev = await this.groupService.getById(req.params.id);
      await this.groupService.remove(req.params.id);

      // Optional: delete the corresponding Sheets tab (off by default).
      if (deleteSheetTab && env.studentsSheetsEnabled && prev?.name) {
        try {
          const sheetsGroups = new StudentsSheetsGroupsService(prisma);
          await sheetsGroups.deleteGroupTab(prev.name);
        } catch (e) {
          console.warn(
            "[AdminGroupController] failed to delete Sheets tab for group",
            (e as any)?.message ?? String(e),
          );
        }
      }
      return ok(res, "Group deleted");
    } catch {
      return fail(res, 500, "Failed to delete group");
    }
  };
}
