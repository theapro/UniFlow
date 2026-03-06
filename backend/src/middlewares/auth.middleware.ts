import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { fail } from "../utils/responses";
import { env } from "../config/env";

type JwtTokenPayload = {
  userId: string;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return fail(res, 401, "Missing or invalid Authorization header");
    }

    const decoded = jwt.verify(token, env.jwtSecret) as JwtTokenPayload;
    if (!decoded?.userId) {
      return fail(res, 401, "Invalid token");
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        studentId: true,
        teacherId: true,
        student: { select: { fullName: true, studentNumber: true } },
        teacher: { select: { fullName: true, staffNo: true } },
      },
    });

    if (!user) {
      return fail(res, 401, "User not found");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      teacherId: user.teacherId,
      ...(user.student
        ? {
            fullName: user.student.fullName,
            studentNo: user.student.studentNumber,
          }
        : {}),
      ...(user.teacher
        ? {
            fullName: user.teacher.fullName,
            staffNo: user.teacher.staffNo,
          }
        : {}),
    };
    return next();
  } catch {
    return fail(res, 401, "Unauthorized");
  }
}
