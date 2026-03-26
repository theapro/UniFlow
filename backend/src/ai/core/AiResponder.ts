import type { AiToolName } from "../../services/ai-tools/toolNames";
import { formatDbTime, formatTimeRange } from "../../utils/time";

type DetectedLang = "en" | "ja" | "uz";

function fmtTimeRange(start: string | null, end: string | null): string {
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return "";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateOnlyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function unknownSubject(lang: "en" | "ja" | "uz"): string {
  if (lang === "ja") return "(科目不明)";
  if (lang === "uz") return "(Fan noma’lum)";
  return "(Unknown subject)";
}

export class AiResponder {
  formatToolResponse(params: {
    tool: AiToolName;
    result: any;
    lang?: DetectedLang;
  }): string {
    const tool = params.tool;
    const lang: DetectedLang = params.lang ?? "en";

    if (tool === "getStudentProfile") {
      const p = params.result?.profile ?? null;
      if (!p) {
        if (lang === "ja") return "プロフィールが見つかりませんでした。";
        if (lang === "uz") return "Profil topilmadi.";
        return "Profile not found.";
      }

      const lines: string[] = [];

      if (lang === "ja") {
        lines.push("あなたのプロフィール:");
        lines.push(`- 名前: ${p.fullName ?? "-"}`);
        lines.push(`- 学籍番号: ${p.studentNumber ?? "-"}`);
        lines.push(`- メール: ${p.email ?? "-"}`);
        lines.push(`- 電話: ${p.phone ?? "-"}`);
        lines.push(`- ステータス: ${p.status ?? "-"}`);
        lines.push(`- グループ: ${p.group?.name ?? "-"}`);
        if (p.note) lines.push(`- メモ: ${String(p.note).slice(0, 240)}`);
      } else if (lang === "uz") {
        lines.push("Sizning profilingiz:");
        lines.push(`- Ism: ${p.fullName ?? "-"}`);
        lines.push(`- Student No: ${p.studentNumber ?? "-"}`);
        lines.push(`- Email: ${p.email ?? "-"}`);
        lines.push(`- Telefon: ${p.phone ?? "-"}`);
        lines.push(`- Status: ${p.status ?? "-"}`);
        lines.push(`- Guruh: ${p.group?.name ?? "-"}`);
        if (p.note) lines.push(`- Izoh: ${String(p.note).slice(0, 240)}`);
      } else {
        lines.push("Your profile:");
        lines.push(`- Name: ${p.fullName ?? "-"}`);
        lines.push(`- Student No: ${p.studentNumber ?? "-"}`);
        lines.push(`- Email: ${p.email ?? "-"}`);
        lines.push(`- Phone: ${p.phone ?? "-"}`);
        lines.push(`- Status: ${p.status ?? "-"}`);
        lines.push(`- Group: ${p.group?.name ?? "-"}`);
        if (p.note) lines.push(`- Note: ${String(p.note).slice(0, 240)}`);
      }
      return lines.join("\n").trim();
    }

    if (tool === "getStudentScheduleToday") {
      const r = params.result ?? {};
      const lines: string[] = [];

      if (lang === "ja") lines.push("今日の予定:");
      else if (lang === "uz") lines.push("Bugungi jadval:");
      else lines.push("Today's schedule:");
      const sched = Array.isArray(r.scheduleToday) ? r.scheduleToday : [];
      if (sched.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 今日は授業がないか、予定が見つかりませんでした。"
            : lang === "uz"
              ? "- Bugun dars yo‘q yoki jadval topilmadi."
              : "- No classes found for today.",
        );
      } else {
        for (const item of sched) {
          const time = fmtTimeRange(
            item.startTime ?? null,
            item.endTime ?? null,
          );
          const subject = item.subject ?? unknownSubject(lang);
          const teacher = item.teacher ? ` — ${item.teacher}` : "";
          const room = item.room ? ` (${item.room})` : "";
          lines.push(`- ${time} ${subject}${teacher}${room}`.trim());
        }
      }

      return lines.join("\n").trim();
    }

    if (
      tool === "getTodaySchedule" ||
      tool === "getWeeklySchedule" ||
      tool === "getMonthlySchedule"
    ) {
      const rows = Array.isArray(params.result) ? params.result : [];

      const lines: string[] = [];
      if (lang === "ja") {
        if (tool === "getTodaySchedule") lines.push("今日の予定:");
        if (tool === "getWeeklySchedule") lines.push("今週の予定:");
        if (tool === "getMonthlySchedule") lines.push("今月の予定:");
      } else if (lang === "uz") {
        if (tool === "getTodaySchedule") lines.push("Bugungi jadval:");
        if (tool === "getWeeklySchedule") lines.push("Haftalik jadval:");
        if (tool === "getMonthlySchedule") lines.push("Oylik jadval:");
      } else {
        if (tool === "getTodaySchedule") lines.push("Today's schedule:");
        if (tool === "getWeeklySchedule") lines.push("Weekly schedule:");
        if (tool === "getMonthlySchedule") lines.push("Monthly schedule:");
      }

      if (rows.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 予定が見つかりませんでした。"
            : lang === "uz"
              ? "- Jadval topilmadi."
              : "- No schedule found.",
        );
        return lines.join("\n").trim();
      }

      for (const r of rows) {
        const date =
          r?.calendarDay?.date instanceof Date ? r.calendarDay.date : null;
        const datePrefix =
          tool === "getTodaySchedule" || !date
            ? ""
            : `${toISODateOnlyUTC(date)} `;

        const time =
          formatTimeRange(
            r?.timeSlot?.startTime ?? null,
            r?.timeSlot?.endTime ?? null,
          ) ??
          formatDbTime(r?.timeSlot?.startTime ?? null) ??
          "";

        const subject = r?.subject?.name ?? unknownSubject(lang);
        const teacher = r?.teacher?.fullName ? ` — ${r.teacher.fullName}` : "";
        const room = r?.room?.name ? ` (${r.room.name})` : "";

        lines.push(`- ${datePrefix}${time} ${subject}${teacher}${room}`.trim());
      }

      return lines.join("\n").trim();
    }

    if (tool === "getStudentAttendanceRecent") {
      const r = params.result ?? {};
      const rows = Array.isArray(r.attendanceRecent) ? r.attendanceRecent : [];

      const lines: string[] = [];
      if (lang === "ja") lines.push("出席（最近）:");
      else if (lang === "uz") lines.push("Davomat (so‘nggi yozuvlar):");
      else lines.push("Attendance (recent):");
      if (rows.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 出席の記録が見つかりませんでした。"
            : lang === "uz"
              ? "- Davomat yozuvlari topilmadi."
              : "- No attendance records found.",
        );
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
      if (lang === "ja") lines.push("成績（最近）:");
      else if (lang === "uz") lines.push("Baholar (so‘nggi yozuvlar):");
      else lines.push("Grades (recent):");
      if (rows.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 成績が見つかりませんでした。"
            : lang === "uz"
              ? "- Baholar topilmadi."
              : "- No grades found.",
        );
      } else {
        for (const g of rows) {
          const subj = g.subject ?? unknownSubject(lang);
          const score = g.score ?? g.rawValue ?? "-";
          lines.push(`- ${subj}: ${score}`);
        }
      }
      return lines.join("\n").trim();
    }

    if (tool === "getStudentDashboard") {
      const r = params.result ?? {};
      const lines: string[] = [];

      if (lang === "ja") lines.push("今日の予定:");
      else if (lang === "uz") lines.push("Bugungi jadval:");
      else lines.push("Today's schedule:");
      const sched = Array.isArray(r.scheduleToday) ? r.scheduleToday : [];
      if (sched.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 今日は授業がないか、予定が見つかりませんでした。"
            : lang === "uz"
              ? "- Bugun dars yo‘q yoki jadval topilmadi."
              : "- No classes found for today.",
        );
      } else {
        for (const item of sched) {
          const time = fmtTimeRange(
            item.startTime ?? null,
            item.endTime ?? null,
          );
          const subject = item.subject ?? unknownSubject(lang);
          const teacher = item.teacher ? ` — ${item.teacher}` : "";
          const room = item.room ? ` (${item.room})` : "";
          lines.push(`- ${time} ${subject}${teacher}${room}`.trim());
        }
      }

      const att = Array.isArray(r.attendanceRecent) ? r.attendanceRecent : [];
      lines.push(
        lang === "ja"
          ? "\n出席（最新5件）:"
          : lang === "uz"
            ? "\nDavomat (oxirgi 5):"
            : "\nAttendance (last 5):",
      );
      if (att.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 出席の記録が見つかりませんでした。"
            : lang === "uz"
              ? "- Davomat yozuvlari topilmadi."
              : "- No attendance records found.",
        );
      } else {
        for (const a of att) {
          const dt = a.lessonStartsAt ?? a.notedAt ?? "";
          const subj = a.subject ? ` — ${a.subject}` : "";
          lines.push(`- ${a.status}${subj} (${dt})`);
        }
      }

      const gr = Array.isArray(r.gradesRecent) ? r.gradesRecent : [];
      lines.push(
        lang === "ja"
          ? "\n成績（最新5件）:"
          : lang === "uz"
            ? "\nBaholar (oxirgi 5):"
            : "\nGrades (last 5):",
      );
      if (gr.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 成績が見つかりませんでした。"
            : lang === "uz"
              ? "- Baholar topilmadi."
              : "- No grades found.",
        );
      } else {
        for (const g of gr) {
          const subj = g.subject ?? unknownSubject(lang);
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
        if (lang === "ja") lines.push(`先生: ${profile.fullName}`);
        else if (lang === "uz") lines.push(`Ustoz: ${profile.fullName}`);
        else lines.push(`Teacher: ${profile.fullName}`);
      }

      if (lang === "ja") lines.push("今日の授業:");
      else if (lang === "uz") lines.push("Bugungi darslaringiz:");
      else lines.push("Your classes today:");
      const lessons = Array.isArray(r.lessonsToday) ? r.lessonsToday : [];
      if (lessons.length === 0) {
        lines.push(
          lang === "ja"
            ? "- 今日の授業は見つかりませんでした。"
            : lang === "uz"
              ? "- Bugun dars topilmadi."
              : "- No classes found today.",
        );
      } else {
        for (const l of lessons) {
          const subj = l.subject ?? unknownSubject(lang);
          const group = l.group ? ` — ${l.group}` : "";
          const dt = l.startsAt ?? "";
          lines.push(`- ${subj}${group} (${dt})`);
        }
      }

      return lines.join("\n").trim();
    }

    if (tool === "getSystemStats") {
      const c = params.result?.counts ?? {};
      const title =
        lang === "ja"
          ? "システム統計:"
          : lang === "uz"
            ? "System stats:"
            : "System stats:";
      const lines = [
        title,
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
