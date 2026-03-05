import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: UserRole;
      studentId: string | null;
      teacherId: string | null;

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
