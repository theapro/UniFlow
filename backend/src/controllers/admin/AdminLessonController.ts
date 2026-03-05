import type { Request, Response } from "express";
import { AdminLessonService } from "../../services/admin/AdminLessonService";
import { created, fail, ok } from "../../utils/responses";

export class AdminLessonController {
  constructor(private readonly lessonService: AdminLessonService) {}

  list = async (req: Request, res: Response) => {
    try {
      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : undefined;
      const teacherId =
        typeof req.query.teacherId === "string"
          ? req.query.teacherId
          : undefined;
      const from =
        typeof req.query.from === "string"
          ? new Date(req.query.from)
          : undefined;
      const to =
        typeof req.query.to === "string" ? new Date(req.query.to) : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const lessons = await this.lessonService.list({
        groupId,
        teacherId,
        from,
        to,
        take,
        skip,
      });
      return ok(res, "Lessons fetched", lessons);
    } catch {
      return fail(res, 500, "Failed to fetch lessons");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const lesson = await this.lessonService.getById(req.params.id);
      if (!lesson) {
        return fail(res, 404, "Lesson not found");
      }
      return ok(res, "Lesson fetched", lesson);
    } catch {
      return fail(res, 500, "Failed to fetch lesson");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { startsAt, endsAt, room, groupId, teacherId, subjectId } =
        req.body ?? {};

      if (!startsAt || !endsAt || !groupId || !teacherId || !subjectId) {
        return fail(
          res,
          400,
          "startsAt, endsAt, groupId, teacherId, subjectId are required",
        );
      }

      const lesson = await this.lessonService.create({
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        room: room ?? null,
        groupId,
        teacherId,
        subjectId,
      });

      return created(res, "Lesson created", lesson);
    } catch {
      return fail(res, 500, "Failed to create lesson");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { startsAt, endsAt, room, groupId, teacherId, subjectId } =
        req.body ?? {};

      const lesson = await this.lessonService.update(req.params.id, {
        ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
        ...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
        ...(room !== undefined ? { room } : {}),
        ...(groupId !== undefined ? { groupId } : {}),
        ...(teacherId !== undefined ? { teacherId } : {}),
        ...(subjectId !== undefined ? { subjectId } : {}),
      });

      return ok(res, "Lesson updated", lesson);
    } catch {
      return fail(res, 500, "Failed to update lesson");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.lessonService.remove(req.params.id);
      return ok(res, "Lesson deleted");
    } catch {
      return fail(res, 500, "Failed to delete lesson");
    }
  };
}
