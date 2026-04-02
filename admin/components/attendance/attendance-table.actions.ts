"use server";

import {
  serverApiGet,
  serverApiPost,
  type ServerApiResult,
} from "@/lib/server-api";
import type { AttendanceTableData } from "@/types/attendance-grades.types";

export async function loadAttendanceTableAction(args: {
  cohortId?: string | null;
  groupId: string;
  subjectId: string;
  from: string;
  to: string;
}): Promise<ServerApiResult<AttendanceTableData>> {
  return serverApiGet<AttendanceTableData>("/api/admin/attendance/table", {
    cohortId: args.cohortId ?? undefined,
    groupId: args.groupId,
    subjectId: args.subjectId,
    from: args.from,
    to: args.to,
  });
}

export async function saveAttendanceTableAction(args: {
  cohortId?: string | null;
  groupId: string;
  subjectId: string;
  dates: string[];
  records: Array<{ studentId: string; date: string; status: string }>;
}): Promise<ServerApiResult<{ saved: number; results: any[] }>> {
  return serverApiPost<{ saved: number; results: any[] }>(
    "/api/admin/attendance/table",
    {
      cohortId: args.cohortId ?? undefined,
      groupId: args.groupId,
      subjectId: args.subjectId,
      dates: args.dates,
      records: args.records,
    },
  );
}
