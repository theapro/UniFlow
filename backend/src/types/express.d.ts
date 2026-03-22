import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: Role;
      studentId: string | null;
      teacherId: string | null;

      permissions: string[];

      fullName?: string | null;
      studentNo?: string | null;
      staffNo?: string | null;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
