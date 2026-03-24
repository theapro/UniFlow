import { PageHeader } from "@/components/shared/PageHeader";
import { AttendanceSheetsActions } from "./AttendanceSheetsActions";

export function AttendanceSheetsHeader({ dict }: { dict: any }) {
  return (
    <PageHeader
      title={dict?.nav?.attendanceSheets ?? "Attendance Sheets"}
      description={
        dict?.sheetsAttendance?.description ??
        "Teachers mark attendance in Google Sheets. This page manages sync and lets you preview tabs."
      }
      actions={<AttendanceSheetsActions dict={dict} />}
    />
  );
}
