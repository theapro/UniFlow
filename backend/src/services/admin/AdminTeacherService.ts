import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import bcrypt from "bcryptjs";
import { generateTemporaryPassword } from "../../utils/password";
import { ResendEmailService } from "../email/ResendEmailService";
import { env } from "../../config/env";

export type CreateTeacherInput = {
  fullName: string;
  email?: string;
  staffNo?: string | null;
  departmentId?: string | null;
};

export type UpdateTeacherInput = {
  fullName?: string;
  email?: string;
  staffNo?: string | null;
  departmentId?: string | null;
};

export class AdminTeacherService {
  async list(params?: { q?: string; take?: number; skip?: number }) {
    const where: Prisma.TeacherWhereInput = params?.q
      ? {
          OR: [
            { fullName: { contains: params.q, mode: "insensitive" } },
            { staffNo: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {};

    return prisma.teacher.findMany({
      where,
      include: {
        department: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: params?.take ?? 50,
      skip: params?.skip ?? 0,
    });
  }

  async getById(id: string) {
    return prisma.teacher.findUnique({
      where: { id },
      include: {
        department: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });
  }

  async create(input: CreateTeacherInput) {
    const hasEmail = typeof input.email === "string" && input.email.length > 0;

    const teacher = await prisma.$transaction(async (tx) => {
      const createdTeacher = await tx.teacher.create({
        data: {
          fullName: input.fullName,
          staffNo: input.staffNo ?? null,
          departmentId: input.departmentId ?? null,
        },
        include: { department: true },
      });

      if (!hasEmail) {
        return createdTeacher;
      }

      const existing = await tx.user.findUnique({
        where: { email: input.email! },
        select: { id: true },
      });
      if (existing) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }

      const password = generateTemporaryPassword();
      const passwordHash = bcrypt.hashSync(password, 10);

      await tx.user.create({
        data: {
          email: input.email!,
          passwordHash,
          role: "TEACHER",
          teacherId: createdTeacher.id,
        },
        select: { id: true },
      });

      return createdTeacher;
    });

    if (hasEmail) {
      if (!env.resendApiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const password = generateTemporaryPassword();
      const passwordHash = bcrypt.hashSync(password, 10);

      await prisma.user.update({
        where: { email: input.email! },
        data: { passwordHash },
      });

      try {
        const mailer = new ResendEmailService();
        await mailer.sendLoginCredentials({
          to: input.email!,
          fullName: input.fullName,
          password,
        });
      } catch (error: any) {
        const emailError =
          typeof error?.message === "string"
            ? error.message
            : "Failed to send credentials email";
        throw new Error(`RESEND_${emailError}`);
      }

      await prisma.user.update({
        where: { email: input.email! },
        data: { credentialsSentAt: new Date() },
      });
    }

    return prisma.teacher.findUnique({
      where: { id: teacher.id },
      include: {
        department: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });
  }

  async update(id: string, input: UpdateTeacherInput) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedTeacher = await tx.teacher.update({
        where: { id },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.staffNo !== undefined ? { staffNo: input.staffNo } : {}),
          ...(input.departmentId !== undefined
            ? { departmentId: input.departmentId }
            : {}),
        },
        include: {
          department: true,
          user: { select: { id: true, email: true } },
        },
      });

      if (!input.email) {
        return {
          teacher: updatedTeacher,
          credentialsToEmail: null as null | { to: string; password: string },
        };
      }

      if (updatedTeacher.user && updatedTeacher.user.email === input.email) {
        return {
          teacher: updatedTeacher,
          credentialsToEmail: null as null | { to: string; password: string },
        };
      }

      const existingEmail = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }

      const password = generateTemporaryPassword();
      const passwordHash = bcrypt.hashSync(password, 10);

      if (updatedTeacher.user) {
        await tx.user.update({
          where: { id: updatedTeacher.user.id },
          data: { email: input.email, passwordHash },
          select: { id: true },
        });

        return {
          teacher: {
            ...updatedTeacher,
            user: { email: input.email },
          },
          credentialsToEmail: { to: input.email, password },
        };
      }

      await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: "TEACHER",
          teacherId: updatedTeacher.id,
        },
        select: { id: true },
      });

      return {
        teacher: {
          ...updatedTeacher,
          user: { email: input.email },
        },
        credentialsToEmail: { to: input.email, password },
      };
    });

    if (result.credentialsToEmail) {
      if (!env.resendApiKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }
      const mailer = new ResendEmailService();
      await mailer.sendLoginCredentials({
        to: result.credentialsToEmail.to,
        fullName: result.teacher.fullName,
        password: result.credentialsToEmail.password,
      });

      await prisma.user.update({
        where: { email: result.credentialsToEmail.to },
        data: { credentialsSentAt: new Date() },
      });
    }

    return prisma.teacher.findUnique({
      where: { id },
      include: {
        department: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });
  }

  async resendCredentials(id: string) {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!teacher) {
      throw new Error("TEACHER_NOT_FOUND");
    }
    if (!teacher.user?.email) {
      throw new Error("TEACHER_EMAIL_NOT_SET");
    }

    const password = generateTemporaryPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    await prisma.user.update({
      where: { id: teacher.user.id },
      data: { passwordHash },
    });

    try {
      const mailer = new ResendEmailService();
      await mailer.sendLoginCredentials({
        to: teacher.user.email,
        fullName: teacher.fullName,
        password,
      });
    } catch (error: any) {
      const emailError =
        typeof error?.message === "string"
          ? error.message
          : "Failed to send credentials email";
      throw new Error(`RESEND_${emailError}`);
    }

    await prisma.user.update({
      where: { id: teacher.user.id },
      data: { credentialsSentAt: new Date() },
    });

    return { email: teacher.user.email };
  }

  async remove(id: string) {
    await prisma.$transaction(async (tx) => {
      // Remove dependent rows first to avoid FK constraint errors
      const lessons = await tx.lesson.findMany({
        where: { teacherId: id },
        select: { id: true },
      });

      const lessonIds = lessons.map((l) => l.id);
      if (lessonIds.length > 0) {
        await tx.attendance.deleteMany({
          where: { lessonId: { in: lessonIds } },
        });
        await tx.lesson.deleteMany({ where: { id: { in: lessonIds } } });
      }

      await tx.scheduleEntry.deleteMany({ where: { teacherId: id } });

      const teacher = await tx.teacher.findUnique({
        where: { id },
        include: { user: { select: { id: true } } },
      });

      if (teacher?.user?.id) {
        await tx.user.delete({ where: { id: teacher.user.id } });
      }

      await tx.teacher.delete({ where: { id } });
    });
    return true;
  }
}
