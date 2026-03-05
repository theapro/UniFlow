import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { fail } from "../utils/responses";

export function roleMiddleware(allowed: UserRole[]) {
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
