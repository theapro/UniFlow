import type { AttendanceStatus } from "@prisma/client";

export function parseAttendanceCell(raw: string): AttendanceStatus | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return null;

  switch (v) {
    case "P":
      return "PRESENT";
    case "A":
      return "ABSENT";
    case "L":
      return "LATE";
    case "E":
      return "EXCUSED";
    default:
      return null;
  }
}

export function formatAttendanceCell(status: AttendanceStatus | null): string {
  if (!status) return "";
  switch (status) {
    case "PRESENT":
      return "P";
    case "ABSENT":
      return "A";
    case "LATE":
      return "L";
    case "EXCUSED":
      return "E";
    default:
      return "";
  }
}
