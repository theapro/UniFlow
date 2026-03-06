import type { Request, Response } from "express";
import { AdminStudentService } from "../../services/admin/AdminStudentService";
import { created, fail, ok } from "../../utils/responses";

function parseStudentStatus(
  value: unknown,
): "ACTIVE" | "INACTIVE" | "GRADUATED" | "DROPPED" | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.toUpperCase();
  if (
    v === "ACTIVE" ||
    v === "INACTIVE" ||
    v === "GRADUATED" ||
    v === "DROPPED"
  ) {
    return v;
  }
  return undefined;
}

export class AdminStudentController {
  constructor(private readonly studentService: AdminStudentService) {}

  list = async (req: Request, res: Response) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : undefined;
      const take =
        typeof req.query.take === "string" ? Number(req.query.take) : undefined;
      const skip =
        typeof req.query.skip === "string" ? Number(req.query.skip) : undefined;

      const students = await this.studentService.list({
        q,
        groupId,
        take,
        skip,
      });
      return ok(res, "Students fetched", students);
    } catch {
      return fail(res, 500, "Failed to fetch students");
    }
  };

  getById = async (req: Request, res: Response) => {
    try {
      const student = await this.studentService.getById(req.params.id);
      if (!student) {
        return fail(res, 404, "Student not found");
      }
      return ok(res, "Student fetched", student);
    } catch {
      return fail(res, 500, "Failed to fetch student");
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const {
        fullName,
        email,
        studentNo,
        groupId,
        cohort,
        phone,
        status,
        note,
      } = req.body ?? {};
      if (!fullName || typeof fullName !== "string") {
        return fail(res, 400, "fullName is required");
      }
      if (!email || typeof email !== "string") {
        return fail(res, 400, "email is required");
      }
      if (!groupId || typeof groupId !== "string") {
        return fail(res, 400, "groupId (group selection) is required");
      }

      const result = await this.studentService.create({
        fullName,
        email,
        studentNo:
          typeof studentNo === "string" ? studentNo : (studentNo ?? null),
        groupId,
        cohort: typeof cohort === "string" ? cohort : (cohort ?? null),
        phone: typeof phone === "string" ? phone : (phone ?? null),
        status: parseStudentStatus(status),
        note: typeof note === "string" ? note : (note ?? null),
      });

      return created(res, "Student created", result);
    } catch (error: any) {
      console.error("[AdminStudentController.create] Error:", {
        message: error?.message,
        stack: error?.stack,
        body: req.body,
      });

      if (error?.message === "EMAIL_ALREADY_EXISTS") {
        return fail(res, 400, "User with this email already exists");
      }
      if (error?.message === "INVALID_GROUP_ID") {
        return fail(res, 400, "groupId must be a valid UUID");
      }
      if (error?.message === "GROUP_NOT_FOUND") {
        return fail(res, 400, "Group not found for provided groupId");
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
      return fail(res, 500, "Failed to create student");
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const {
        fullName,
        email,
        studentNo,
        groupId,
        cohort,
        phone,
        status,
        note,
      } = req.body ?? {};

      const student = await this.studentService.update(req.params.id, {
        ...(fullName !== undefined ? { fullName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(studentNo !== undefined ? { studentNo } : {}),
        ...(groupId !== undefined ? { groupId } : {}),
        ...(cohort !== undefined ? { cohort } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(status !== undefined ? { status: parseStudentStatus(status) } : {}),
        ...(note !== undefined ? { note } : {}),
      });

      return ok(res, "Student updated", student);
    } catch (error: any) {
      if (error?.message === "EMAIL_ALREADY_EXISTS") {
        return fail(res, 400, "User with this email already exists");
      }
      if (error?.message === "INVALID_GROUP_ID") {
        return fail(res, 400, "groupId must be a valid UUID");
      }
      if (error?.message === "GROUP_NOT_FOUND") {
        return fail(res, 400, "Group not found for provided groupId");
      }
      return fail(res, 500, "Failed to update student");
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.studentService.remove(req.params.id);
      return ok(res, "Student deleted");
    } catch {
      return fail(res, 500, "Failed to delete student");
    }
  };

  resendCredentials = async (req: Request, res: Response) => {
    try {
      const result = await this.studentService.resendCredentials(req.params.id);
      return ok(res, "Credentials resent", result);
    } catch (error: any) {
      if (error?.message === "STUDENT_NOT_FOUND") {
        return fail(res, 404, "Student not found");
      }
      if (error?.message === "STUDENT_EMAIL_NOT_SET") {
        return fail(res, 400, "Student email is not set");
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
