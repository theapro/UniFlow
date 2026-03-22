import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { fail } from "../utils/responses";

export function roleMiddleware(allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!allowed.includes(user.role)) {
      return fail(res, 403, "Forbidden");
    }

    return next();
  };
}
