import type { Request, Response } from "express";
import { AdminRoomsService } from "../../services/admin/AdminRoomsService";
import { created, fail, ok } from "../../utils/responses";

export class AdminRoomsController {
  constructor(private readonly roomsService: AdminRoomsService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const rooms = await this.roomsService.list({ q, take, skip });
      return ok(res, "Rooms fetched", rooms);
    } catch {
      return fail(res, 500, "Failed to fetch rooms");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const room = await this.roomsService.getById(req.params.id);
      if (!room) {
        return fail(res, 404, "Room not found");
      }
      return ok(res, "Room fetched", room);
    } catch {
      return fail(res, 500, "Failed to fetch room");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name, capacity } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return fail(res, 400, "name is required");
      }

      const parsedCapacity =
        capacity === undefined || capacity === null || capacity === ""
          ? null
          : Number(capacity);

      if (
        parsedCapacity !== null &&
        (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)
      ) {
        return fail(res, 400, "capacity must be a non-negative number or null");
      }

      const room = await this.roomsService.create({
        name,
        capacity: parsedCapacity,
      });

      return created(res, "Room created", room);
    } catch (err: any) {
      if (err?.code === "P2002") {
        return fail(res, 400, "Room with this name already exists");
      }
      return fail(res, 500, "Failed to create room");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { name, capacity } = req.body ?? {};

      const parsedCapacity =
        capacity === undefined
          ? undefined
          : capacity === null || capacity === ""
            ? null
            : Number(capacity);

      if (
        parsedCapacity !== undefined &&
        parsedCapacity !== null &&
        (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)
      ) {
        return fail(res, 400, "capacity must be a non-negative number or null");
      }

      const room = await this.roomsService.update(req.params.id, {
        ...(name !== undefined ? { name } : {}),
        ...(parsedCapacity !== undefined ? { capacity: parsedCapacity } : {}),
      });

      return ok(res, "Room updated", room);
    } catch (err: any) {
      if (err?.code === "P2002") {
        return fail(res, 400, "Room with this name already exists");
      }
      return fail(res, 500, "Failed to update room");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.roomsService.remove(req.params.id);
      return ok(res, "Room deleted");
    } catch (err: any) {
      if (err?.code === "P2003" || err?.code === "P2014") {
        return fail(res, 409, "Room is in use and cannot be deleted");
      }
      return fail(res, 500, "Failed to delete room");
    }
  };
}
