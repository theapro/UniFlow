import type { AiToolName } from "../../services/ai-tools/toolNames";

function fmtTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return "";
}

export class AiResponder {
  formatToolResponse(params: { tool: AiToolName; result: any }): string {
    const tool = params.tool;

    if (tool === "getStudentProfile") {
      const p = params.result?.profile ?? null;
      if (!p) return "Profil topilmadi.";

      const lines: string[] = [];
      lines.push("Sizning profilingiz:");
      lines.push(`- Ism: ${p.fullName ?? "-"}`);
      lines.push(`- Student No: ${p.studentNumber ?? "-"}`);
      lines.push(`- Email: ${p.email ?? "-"}`);
      lines.push(`- Telefon: ${p.phone ?? "-"}`);
      lines.push(`- Status: ${p.status ?? "-"}`);
      lines.push(`- Guruh: ${p.group?.name ?? "-"}`);
      if (p.note) lines.push(`- Izoh: ${String(p.note).slice(0, 240)}`);
      return lines.join("\n").trim();
    }

    if (tool === "getStudentScheduleToday") {
      const r = params.result ?? {};
      const lines: string[] = [];

      lines.push("Bugungi jadval:");
      const sched = Array.isArray(r.scheduleToday) ? r.scheduleToday : [];
      if (sched.length === 0) {
        lines.push("- Bugun dars yo‘q yoki jadval topilmadi.");
      } else {
        for (const item of sched) {
          const time = fmtTimeRange(
            item.startTime ?? null,
            item.endTime ?? null,
          );
          const subject = item.subject ?? "(Fan noma’lum)";
          const teacher = item.teacher ? ` — ${item.teacher}` : "";
          const room = item.room ? ` (${item.room})` : "";
          lines.push(`- ${time} ${subject}${teacher}${room}`.trim());
        }
      }

      return lines.join("\n").trim();
    }

    if (tool === "getStudentAttendanceRecent") {
      const r = params.result ?? {};
      const rows = Array.isArray(r.attendanceRecent) ? r.attendanceRecent : [];

      const lines: string[] = [];
      lines.push("Davomat (so‘nggi yozuvlar):");
      if (rows.length === 0) {
        lines.push("- Davomat yozuvlari topilmadi.");
      } else {
        for (const a of rows) {
          const dt = a.lessonStartsAt ?? a.notedAt ?? "";
          const subj = a.subject ? ` — ${a.subject}` : "";
          lines.push(`- ${a.status}${subj} (${dt})`);
        }
      }
      return lines.join("\n").trim();
    }

    if (tool === "getStudentGradesRecent") {
      const r = params.result ?? {};
      const rows = Array.isArray(r.gradesRecent) ? r.gradesRecent : [];

      const lines: string[] = [];
      lines.push("Baholar (so‘nggi yozuvlar):");
      if (rows.length === 0) {
        lines.push("- Baholar topilmadi.");
      } else {
        for (const g of rows) {
          const subj = g.subject ?? "(Fan noma’lum)";
          const score = g.score ?? g.rawValue ?? "-";
          lines.push(`- ${subj}: ${score}`);
        }
      }
      return lines.join("\n").trim();
    }

    if (tool === "getStudentDashboard") {
      const r = params.result ?? {};
      const lines: string[] = [];

      lines.push("Bugungi jadval:");
      const sched = Array.isArray(r.scheduleToday) ? r.scheduleToday : [];
      if (sched.length === 0) {
        lines.push("- Bugun dars yo‘q yoki jadval topilmadi.");
      } else {
        for (const item of sched) {
          const time = fmtTimeRange(
            item.startTime ?? null,
            item.endTime ?? null,
          );
          const subject = item.subject ?? "(Fan noma’lum)";
          const teacher = item.teacher ? ` — ${item.teacher}` : "";
          const room = item.room ? ` (${item.room})` : "";
          lines.push(`- ${time} ${subject}${teacher}${room}`.trim());
        }
      }

      const att = Array.isArray(r.attendanceRecent) ? r.attendanceRecent : [];
      lines.push("\nDavomat (oxirgi 5):");
      if (att.length === 0) {
        lines.push("- Davomat yozuvlari topilmadi.");
      } else {
        for (const a of att) {
          const dt = a.lessonStartsAt ?? a.notedAt ?? "";
          const subj = a.subject ? ` — ${a.subject}` : "";
          lines.push(`- ${a.status}${subj} (${dt})`);
        }
      }

      const gr = Array.isArray(r.gradesRecent) ? r.gradesRecent : [];
      lines.push("\nBaholar (oxirgi 5):");
      if (gr.length === 0) {
        lines.push("- Baholar topilmadi.");
      } else {
        for (const g of gr) {
          const subj = g.subject ?? "(Fan noma’lum)";
          const score = g.score ?? g.rawValue ?? "-";
          lines.push(`- ${subj}: ${score}`);
        }
      }

      return lines.join("\n").trim();
    }

    if (tool === "getTeacherDashboard") {
      const r = params.result ?? {};
      const lines: string[] = [];

      const profile = r.profile;
      if (profile?.fullName) {
        lines.push(`Ustoz: ${profile.fullName}`);
      }

      lines.push("Bugungi darslaringiz:");
      const lessons = Array.isArray(r.lessonsToday) ? r.lessonsToday : [];
      if (lessons.length === 0) {
        lines.push("- Bugun dars topilmadi.");
      } else {
        for (const l of lessons) {
          const subj = l.subject ?? "(Fan noma’lum)";
          const group = l.group ? ` — ${l.group}` : "";
          const dt = l.startsAt ?? "";
          lines.push(`- ${subj}${group} (${dt})`);
        }
      }

      return lines.join("\n").trim();
    }

    if (tool === "getSystemStats") {
      const c = params.result?.counts ?? {};
      const lines = [
        "System stats:",
        `- Users: ${c.users ?? 0}`,
        `- Students: ${c.students ?? 0}`,
        `- Teachers: ${c.teachers ?? 0}`,
        `- Groups: ${c.groups ?? 0}`,
        `- Lessons: ${c.lessons ?? 0}`,
        `- Schedule entries: ${c.scheduleEntries ?? 0}`,
        `- Attendance: ${c.attendance ?? 0}`,
        `- Grade books: ${c.gradeBooks ?? 0}`,
        `- Grade records: ${c.gradeRecords ?? 0}`,
      ];
      return lines.join("\n");
    }

    return "OK";
  }
}
