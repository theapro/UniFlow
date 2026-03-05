import type { Request, Response } from "express";
import { AdminTeacherService } from "../../services/admin/AdminTeacherService";
import { created, fail, ok } from "../../utils/responses";

export class AdminTeacherController {
  constructor(private readonly teacherService: AdminTeacherService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const teachers = await this.teacherService.list({ q, take, skip });
      return ok(res, "Teachers fetched", teachers);
    } catch {
      return fail(res, 500, "Failed to fetch teachers");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const teacher = await this.teacherService.getById(req.params.id);
      if (!teacher) {
        return fail(res, 404, "Teacher not found");
      }
      return ok(res, "Teacher fetched", teacher);
    } catch {
      return fail(res, 500, "Failed to fetch teacher");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { fullName, email, staffNo, departmentId } = req.body ?? {};
      if (!fullName || typeof fullName !== "string") {
        return fail(res, 400, "fullName is required");
      }

      const safeEmail = typeof email === "string" ? email : undefined;

      const teacher = await this.teacherService.create({
        fullName,
        ...(safeEmail ? { email: safeEmail } : {}),
        staffNo: typeof staffNo === "string" ? staffNo : (staffNo ?? null),
        departmentId:
          typeof departmentId === "string"
            ? departmentId
            : (departmentId ?? null),
      });

      return created(res, "Teacher created", teacher);
    } catch (error: any) {
      if (error?.message === "EMAIL_ALREADY_EXISTS") {
        return fail(res, 400, "User with this email already exists");
      }
      if (
        typeof error?.message === "string" &&
        error.message.startsWith("RESEND_")
      ) {
        return fail(
          res,
          500,
          "Failed to send login credentials email. Check RESEND_API_KEY / RESEND_FROM_EMAIL sender verification.",
        );
      }
      return fail(res, 500, "Failed to create teacher");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { fullName, email, staffNo, departmentId } = req.body ?? {};

      const teacher = await this.teacherService.update(req.params.id, {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(staffNo !== undefined ? { staffNo } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
      });

      return ok(res, "Teacher updated", teacher);
    } catch (error: any) {
      if (error?.message === "EMAIL_ALREADY_EXISTS") {
        return fail(res, 400, "User with this email already exists");
      }
      return fail(res, 500, "Failed to update teacher");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.teacherService.remove(req.params.id);
      return ok(res, "Teacher deleted");
    } catch {
      return fail(res, 500, "Failed to delete teacher");
    }
  };

  resendCredentials = async (req: Request, res: Response) => {
    try {
      const result = await this.teacherService.resendCredentials(req.params.id);
      return ok(res, "Credentials resent", result);
    } catch (error: any) {
      if (error?.message === "TEACHER_NOT_FOUND") {
        return fail(res, 404, "Teacher not found");
      }
      if (error?.message === "TEACHER_EMAIL_NOT_SET") {
        return fail(res, 400, "Teacher email is not set");
      }
      if (
        typeof error?.message === "string" &&
        error.message.startsWith("RESEND_")
      ) {
        return fail(
          res,
          500,
          "Failed to send login credentials email. Check RESEND_API_KEY / RESEND_FROM_EMAIL sender verification.",
        );
      }
      return fail(res, 500, "Failed to resend credentials");
    }
  };
}
