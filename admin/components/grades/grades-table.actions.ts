"use server";

import {
  serverApiGet,
  serverApiPost,
  type ServerApiResult,
} from "@/lib/server-api";
import type { GradesTableData } from "@/types/attendance-grades.types";

export async function loadGradesTableAction(args: {
  cohortId?: string | null;
  groupId: string;
  subjectId: string;
  from?: string | null;
  to?: string | null;
}): Promise<ServerApiResult<GradesTableData>> {
  return serverApiGet<GradesTableData>("/api/admin/grades/table", {
    cohortId: args.cohortId ?? undefined,
    groupId: args.groupId,
    subjectId: args.subjectId,
    from: args.from ?? undefined,
    to: args.to ?? undefined,
  });
}

export async function saveGradesTableAction(args: {
  cohortId?: string | null;
  groupId: string;
  subjectId: string;
  assignmentCount: number;
  records: Array<{
    studentId: string;
    assignmentIndex: number;
    grade: number | null;
  }>;
}): Promise<ServerApiResult<{ updated: number }>> {
  return serverApiPost<{ updated: number }>("/api/admin/grades/table", {
    cohortId: args.cohortId ?? undefined,
    groupId: args.groupId,
    subjectId: args.subjectId,
    assignmentCount: args.assignmentCount,
    records: args.records,
  });
}
