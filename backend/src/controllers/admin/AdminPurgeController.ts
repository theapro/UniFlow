import type { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { fail, ok } from "../../utils/responses";
import { StudentsSheetsGroupsService } from "../../services/students-sheets/StudentsSheetsGroupsService";
import { TeachersSheetsClient } from "../../services/teachers-sheets/TeachersSheetsClient";
import { GradesSheetsClient } from "../../services/grades-sheets/GradesSheetsClient";
import { AttendanceSheetsClient } from "../../services/attendance-sheets/AttendanceSheetsClient";

function compileOptionalRegex(value: string | undefined | null): RegExp | null {
  if (!value) return null;
  try {
    return new RegExp(value);
  } catch {
    return null;
  }
}

function isAllowedUnderscoreTab(params: {
  title: string;
  allowRe: RegExp | null;
  denyRe: RegExp | null;
}) {
  const t = String(params.title ?? "").trim();
  if (!t) return false;
  if (!t.includes("_")) return false;
  if (params.allowRe && !params.allowRe.test(t)) return false;
  if (params.denyRe && params.denyRe.test(t)) return false;
  return true;
}

function isAllowedByRegex(params: {
  title: string;
  allowRe: RegExp | null;
  denyRe: RegExp | null;
}) {
  const t = String(params.title ?? "").trim();
  if (!t) return false;
  if (params.allowRe && !params.allowRe.test(t)) return false;
  if (params.denyRe && params.denyRe.test(t)) return false;
  return true;
}

export class AdminPurgeController {
  static readonly CONFIRM_TEXT = "DELETE_ALL_NON_ADMIN_DATA";

  purgeAll = async (req: Request, res: Response) => {
    try {
      const confirm = String(req.body?.confirm ?? "").trim();
      if (confirm !== AdminPurgeController.CONFIRM_TEXT) {
        return fail(
          res,
          400,
          `confirm must equal ${AdminPurgeController.CONFIRM_TEXT}`,
        );
      }

      const alsoSheets = req.body?.syncSheets !== false;

      const startedAt = Date.now();
      const deleted = await this.purgeDb();

      const sheets = alsoSheets ? await this.purgeSheetsBestEffort() : null;

      return ok(res, "OK", {
        deleted,
        sheets,
        ms: Date.now() - startedAt,
      });
    } catch (error: any) {
      const msg =
        typeof error?.message === "string" ? error.message : "PURGE_FAILED";
      console.error("AdminPurgeController.purgeAll failed:", error);
      return fail(res, 500, msg);
    }
  };

  private async purgeDb(): Promise<Record<string, number>> {
    // Order matters to avoid FK constraint errors.
    const result: Record<string, number> = {};

    // Attendance must be removed before lessons/students.
    result.attendance = (await prisma.attendance.deleteMany({})).count;

    // Lessons must be removed before teachers/groups/subjects.
    result.lessons = (await prisma.lesson.deleteMany({})).count;

    // Schedule entries must be removed before groups/teachers/subjects/timeslots.
    result.scheduleEntries = (await prisma.scheduleEntry.deleteMany({})).count;

    // Grades
    result.gradeRecords = (await prisma.gradeRecord.deleteMany({})).count;
    result.gradeBooks = (await prisma.gradeBook.deleteMany({})).count;

    // Non-admin users (cascade deletes chat sessions, chats, profiles, login codes, invitations)
    result.users = (
      await prisma.user.deleteMany({
        where: { role: { not: "ADMIN" } },
      })
    ).count;

    // Domain entities
    result.students = (await prisma.student.deleteMany({})).count;
    result.teachers = (await prisma.teacher.deleteMany({})).count;
    result.subjects = (await prisma.subject.deleteMany({})).count;
    result.groups = (await prisma.group.deleteMany({})).count;

    // Supporting entities
    result.departments = (await prisma.department.deleteMany({})).count;
    result.rooms = (await prisma.room.deleteMany({})).count;
    result.timeSlots = (await prisma.timeSlot.deleteMany({})).count;
    result.cohorts = (await prisma.cohort.deleteMany({})).count;

    return result;
  }

  private async purgeSheetsBestEffort(): Promise<{
    students: { deletedTabs: string[]; errors: string[] } | null;
    teachers: { deletedTabs: string[]; errors: string[] } | null;
    attendance: { deletedTabs: string[]; errors: string[] } | null;
    grades: { deletedTabs: string[]; errors: string[] } | null;
  }> {
    const out: {
      students: { deletedTabs: string[]; errors: string[] } | null;
      teachers: { deletedTabs: string[]; errors: string[] } | null;
      attendance: { deletedTabs: string[]; errors: string[] } | null;
      grades: { deletedTabs: string[]; errors: string[] } | null;
    } = {
      students: null,
      teachers: null,
      attendance: null,
      grades: null,
    };

    // Students Sheets: delete all VALID group tabs (those that match required header).
    if (env.studentsSheetsEnabled) {
      const deletedTabs: string[] = [];
      const errors: string[] = [];
      try {
        const svc = new StudentsSheetsGroupsService(prisma);
        const status = await svc.getGroupsStatus();

        for (const tab of status.validGroupTabs) {
          try {
            await svc.deleteGroupTab(tab);
            deletedTabs.push(tab);
          } catch (e: any) {
            const msg = typeof e?.message === "string" ? e.message : String(e);
            errors.push(`${tab}: ${msg}`);
          }
        }
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        errors.push(msg);
      }
      out.students = { deletedTabs, errors };
    }

    // Teachers Sheets: delete allowed subject tabs.
    if (env.teachersSheetsEnabled) {
      const deletedTabs: string[] = [];
      const errors: string[] = [];
      try {
        const client = new TeachersSheetsClient();
        const meta = await client.getSpreadsheetMetadata();
        const allowRe = compileOptionalRegex(env.teachersSheetsSubjectTabsAllowRegex);
        const denyRe = compileOptionalRegex(env.teachersSheetsSubjectTabsDenyRegex);

        for (const tab of meta.sheetTitles) {
          if (!isAllowedByRegex({ title: tab, allowRe, denyRe })) continue;
          try {
            await client.deleteSheetTab({ title: tab });
            deletedTabs.push(tab);
          } catch (e: any) {
            const msg = typeof e?.message === "string" ? e.message : String(e);
            errors.push(`${tab}: ${msg}`);
          }
        }
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        errors.push(msg);
      }
      out.teachers = { deletedTabs, errors };
    }

    // Attendance Sheets: delete allowed GROUP_SUBJECT tabs.
    if (env.attendanceSheetsEnabled) {
      const deletedTabs: string[] = [];
      const errors: string[] = [];
      try {
        const client = new AttendanceSheetsClient();
        const meta = await client.getSpreadsheetMetadata();
        const allowRe = compileOptionalRegex(env.attendanceSheetsTabsAllowRegex);
        const denyRe = compileOptionalRegex(env.attendanceSheetsTabsDenyRegex);

        for (const tab of meta.sheetTitles) {
          if (!isAllowedUnderscoreTab({ title: tab, allowRe, denyRe })) continue;
          try {
            await client.deleteSheetTab({ title: tab });
            deletedTabs.push(tab);
          } catch (e: any) {
            const msg = typeof e?.message === "string" ? e.message : String(e);
            errors.push(`${tab}: ${msg}`);
          }
        }
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        errors.push(msg);
      }
      out.attendance = { deletedTabs, errors };
    }

    // Grades Sheets: delete allowed GROUP_SUBJECT tabs.
    if (env.gradesSheetsEnabled) {
      const deletedTabs: string[] = [];
      const errors: string[] = [];
      try {
        const client = new GradesSheetsClient();
        const meta = await client.getSpreadsheetMetadata();
        const allowRe = compileOptionalRegex(env.gradesSheetsTabsAllowRegex);
        const denyRe = compileOptionalRegex(env.gradesSheetsTabsDenyRegex);

        for (const tab of meta.sheetTitles) {
          if (!isAllowedUnderscoreTab({ title: tab, allowRe, denyRe })) continue;
          try {
            await client.deleteSheetTab({ title: tab });
            deletedTabs.push(tab);
          } catch (e: any) {
            const msg = typeof e?.message === "string" ? e.message : String(e);
            errors.push(`${tab}: ${msg}`);
          }
        }
      } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : String(e);
        errors.push(msg);
      }
      out.grades = { deletedTabs, errors };
    }

    return out;
  }
}
