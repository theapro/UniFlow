import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import bcrypt from "bcryptjs";
import { generateTemporaryPassword } from "../../utils/password";
import { ResendEmailService } from "../email/ResendEmailService";
import { env } from "../../config/env";
import { StudentsSheetsOutboxService } from "../students-sheets/StudentsSheetsOutboxService";

export type CreateStudentInput = {
  fullName: string;
  email: string;
  studentNo?: string | null;
  phone?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "GRADUATED" | "DROPPED";
  teacherIds?: string[];
  parentIds?: string[];
  note?: string | null;
  groupId?: string | null;
};

export type UpdateStudentInput = {
  fullName?: string;
  email?: string;
  studentNo?: string | null;
  phone?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "GRADUATED" | "DROPPED";
  teacherIds?: string[];
  parentIds?: string[];
  note?: string | null;
  groupId?: string | null;
};

export class AdminStudentService {
  private isUuid(value: string): boolean {
    // UUID v1-v5
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  async list(params?: {
    q?: string;
    groupId?: string;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.StudentWhereInput = params?.q
      ? {
          OR: [
            { fullName: { contains: params.q, mode: "insensitive" } },
            { studentNumber: { contains: params.q, mode: "insensitive" } },
            { email: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {};

    if (params?.groupId) {
      where.groupId = params.groupId;
    }

    return prisma.student.findMany({
      where,
      include: {
        group: true,
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
    return prisma.student.findUnique({
      where: { id },
      include: {
        group: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });
  }

  async create(input: CreateStudentInput) {
    const password = generateTemporaryPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    if (input.groupId != null) {
      if (typeof input.groupId !== "string" || !this.isUuid(input.groupId)) {
        throw new Error("INVALID_GROUP_ID");
      }
    }

    const { student, user } = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existing) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }

      const group = input.groupId
        ? await tx.group.findUnique({
            where: { id: input.groupId },
            select: {
              id: true,
              name: true,
              cohort: { select: { year: true } },
            },
          })
        : null;
      if (input.groupId && !group) throw new Error("GROUP_NOT_FOUND");

      const createdStudent = await tx.student.create({
        data: {
          fullName: input.fullName,
          studentNumber: input.studentNo ?? null,
          email: input.email,
          phone: input.phone ?? null,
          status: input.status ?? "ACTIVE",
          teacherIds: input.teacherIds ?? [],
          parentIds: input.parentIds ?? [],
          note: input.note ?? null,
          groupId: group?.id ?? null,
          groupName: group?.name ?? null,
          cohort: group?.cohort?.year ? String(group.cohort.year) : null,
          updatedAt: new Date(),
        },
        include: { group: true },
      });

      const createdUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: "STUDENT",
          studentId: createdStudent.id,
        },
        select: { id: true, email: true },
      });

      return { student: createdStudent, user: createdUser };
    });

    let emailSent = false;
    let emailError: string | null = null;

    const canSendEmail = Boolean(env.resendApiKey);
    if (canSendEmail) {
      try {
        const mailer = new ResendEmailService();
        await mailer.sendLoginCredentials({
          to: user.email,
          fullName: student.fullName,
          password,
        });
        emailSent = true;

        await prisma.user.update({
          where: { id: user.id },
          data: { credentialsSentAt: new Date() },
        });
      } catch (error: any) {
        emailError =
          typeof error?.message === "string"
            ? error.message
            : "Failed to send credentials email";
        // Convert to prefix for controller handling
        const pref = `RESEND_${emailError}`;
        throw new Error(pref);
      }
    } else {
      emailError =
        "Email is not configured (missing RESEND_API_KEY/RESEND_FROM_EMAIL)";
    }

    const createdStudent = await prisma.student.findUnique({
      where: { id: student.id },
      include: {
        group: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });

    try {
      const outbox = new StudentsSheetsOutboxService(prisma);
      await outbox.enqueueUpsert({
        studentId: student.id,
        targetSheetTitle: createdStudent?.group?.name ?? null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[SheetsSync][Outbox] failed to enqueue student create", e);
    }

    return {
      student: createdStudent,
      credentials: {
        email: user.email,
        password,
        emailSent,
        ...(emailError ? { emailError } : {}),
      },
    };
  }

  async update(id: string, input: UpdateStudentInput) {
    if (input.groupId !== undefined && input.groupId !== null) {
      if (typeof input.groupId !== "string" || !this.isUuid(input.groupId)) {
        throw new Error("INVALID_GROUP_ID");
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const group = input.groupId
        ? await tx.group.findUnique({
            where: { id: input.groupId },
            select: {
              id: true,
              name: true,
              cohort: { select: { year: true } },
            },
          })
        : null;
      if (input.groupId && !group) throw new Error("GROUP_NOT_FOUND");

      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
          ...(input.studentNo !== undefined
            ? { studentNumber: input.studentNo }
            : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.teacherIds !== undefined
            ? { teacherIds: input.teacherIds }
            : {}),
          ...(input.parentIds !== undefined
            ? { parentIds: input.parentIds }
            : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          ...(input.groupId !== undefined
            ? {
                groupId: group?.id ?? null,
                groupName: group?.name ?? null,
                cohort: group?.cohort?.year ? String(group.cohort.year) : null,
              }
            : {}),
          updatedAt: new Date(),
        },
        include: { group: true, user: { select: { id: true, email: true } } },
      });

      if (!input.email) {
        return {
          student: updatedStudent,
          credentialsToEmail: null as null | { to: string; password: string },
        };
      }

      // If user exists and email didn't change, do nothing
      if (updatedStudent.user && updatedStudent.user.email === input.email) {
        return {
          student: updatedStudent,
          credentialsToEmail: null as null | { to: string; password: string },
        };
      }

      // Ensure email is unique
      const existingEmail = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }

      const password = generateTemporaryPassword();
      const passwordHash = bcrypt.hashSync(password, 10);

      if (updatedStudent.user) {
        await tx.user.update({
          where: { id: updatedStudent.user.id },
          data: { email: input.email, passwordHash },
          select: { id: true },
        });
        return {
          student: {
            ...updatedStudent,
            user: { email: input.email },
          },
          credentialsToEmail: { to: input.email, password },
        };
      }

      await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: "STUDENT",
          studentId: updatedStudent.id,
        },
        select: { id: true },
      });

      return {
        student: {
          ...updatedStudent,
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
        fullName: result.student.fullName,
        password: result.credentialsToEmail.password,
      });

      await prisma.user.update({
        where: { email: result.credentialsToEmail.to },
        data: { credentialsSentAt: new Date() },
      });
    }

    const updated = await prisma.student.findUnique({
      where: { id },
      include: {
        group: true,
        user: {
          select: { email: true, lastLoginAt: true, credentialsSentAt: true },
        },
      },
    });

    try {
      const outbox = new StudentsSheetsOutboxService(prisma);
      await outbox.enqueueUpsert({
        studentId: id,
        targetSheetTitle: updated?.group?.name ?? null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[SheetsSync][Outbox] failed to enqueue student update", e);
    }

    return updated;
  }

  async resendCredentials(id: string) {
    if (!env.resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!student) {
      throw new Error("STUDENT_NOT_FOUND");
    }
    if (!student.user?.email) {
      throw new Error("STUDENT_EMAIL_NOT_SET");
    }

    const password = generateTemporaryPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    await prisma.user.update({
      where: { id: student.user.id },
      data: { passwordHash },
    });

    try {
      const mailer = new ResendEmailService();
      await mailer.sendLoginCredentials({
        to: student.user.email,
        fullName: student.fullName,
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
      where: { id: student.user.id },
      data: { credentialsSentAt: new Date() },
    });

    return { email: student.user.email };
  }

  async remove(id: string) {
    const before = await prisma.student.findUnique({
      where: { id },
      include: { group: { select: { name: true } } },
    });

    await prisma.$transaction(async (tx) => {
      // Remove dependent rows first to avoid FK constraint errors
      await tx.attendance.deleteMany({ where: { studentId: id } });

      const student = await tx.student.findUnique({
        where: { id },
        include: { user: { select: { id: true } } },
      });

      if (student?.user?.id) {
        await tx.user.delete({ where: { id: student.user.id } });
      }

      await tx.student.delete({ where: { id } });
    });

    try {
      const outbox = new StudentsSheetsOutboxService(prisma);
      await outbox.enqueueDelete({
        studentId: id,
        lastKnownSheetTitle: before?.group?.name ?? null,
        payload: before
          ? {
              student_uuid: before.id,
              group: before.group?.name ?? null,
            }
          : undefined,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[SheetsSync][Outbox] failed to enqueue student delete", e);
    }

    return true;
  }
}
