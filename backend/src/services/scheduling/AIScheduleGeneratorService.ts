import { spawn } from "node:child_process";
import path from "node:path";

import { prisma } from "../../config/prisma";

export type AiScheduleRuleInput = {
  groupId: string;
  subjectId: string;
  teacherId: string;
  roomId?: string | null;
  lessons: number;
  note?: string | null;
};

export type AiTeacherUnavailable = {
  teacherId: string;
  date: string; // YYYY-MM-DD
  timeSlotId: string;
};

export type AiGeneratedLesson = {
  date: string; // YYYY-MM-DD
  timeSlotId: string;
  groupId: string;
  teacherId: string;
  subjectId: string;
  roomId?: string | null;
  note?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODateOnlyUTC(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function parseISODateOnlyToUTC(value: string): Date | null {
  const trimmed = String(value ?? "").trim();
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
  if (!m) return null;
  const y = Number(m[1]);
  const mon = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) {
    return null;
  }
  if (mon < 1 || mon > 12) return null;
  if (d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mon - 1, d, 0, 0, 0, 0));
}

function monthDatesUTC(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const out: Date[] = [];
  for (let d = new Date(first); d < nextMonth; d = new Date(d.getTime())) {
    out.push(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function resolveSolverPath() {
  // In dev (tsx), `src` exists. In prod (dist), the repo still typically ships `src`.
  // We resolve from CWD first, then fallback relative to current file.
  const cwdCandidate = path.resolve(
    process.cwd(),
    "src/services/scheduling/solver/solve_monthly_schedule.py",
  );

  const relCandidate = path.resolve(
    __dirname,
    "../../../../src/services/scheduling/solver/solve_monthly_schedule.py",
  );

  return { cwdCandidate, relCandidate };
}

async function runPythonSolver(payload: any): Promise<any> {
  const { cwdCandidate, relCandidate } = resolveSolverPath();

  const scriptPath = cwdCandidate;
  const pythonExe =
    process.env.UNIFLOW_PYTHON ||
    process.env.PYTHON ||
    (process.platform === "win32" ? "python" : "python3");

  const tryRun = (candidate: string) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve) => {
        const child = spawn(pythonExe, [candidate], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (d) => (stdout += String(d)));
        child.stderr.on("data", (d) => (stderr += String(d)));
        child.on("close", (code) => resolve({ code, stdout, stderr }));

        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      },
    );

  // Try CWD path first; fallback to relative path (useful when CWD is different).
  const first = await tryRun(scriptPath);
  const second =
    first.code === 0 && first.stdout.trim() ? null : await tryRun(relCandidate);

  const final = second ?? first;

  if (!final.stdout.trim()) {
    const msg = final.stderr.trim() || "AI solver did not return output";
    throw new Error(msg);
  }

  try {
    return JSON.parse(final.stdout);
  } catch {
    throw new Error("AI solver returned invalid JSON");
  }
}

export class AIScheduleGeneratorService {
  async generateMonthlySchedule(params: {
    month: number;
    year: number;
    requirements?: AiScheduleRuleInput[];
    // Backward compatibility for legacy clients
    rules?: AiScheduleRuleInput[];
    holidays?: string[];
    workingDays?: number[]; // 0=Sun..6=Sat
    notes?: string;
    teacherUnavailable?: AiTeacherUnavailable[];
    maxSeconds?: number;
  }): Promise<
    | { ok: true; generatedLessons: AiGeneratedLesson[] }
    | { ok: false; status: number; message: string }
  > {
    const month = params.month;
    const year = params.year;

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return { ok: false, status: 400, message: "month must be 1..12" };
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return { ok: false, status: 400, message: "year must be 2000..2100" };
    }

    const requirements = Array.isArray(params.requirements)
      ? params.requirements
      : Array.isArray(params.rules)
        ? params.rules
        : [];

    if (!requirements.length) {
      return { ok: false, status: 400, message: "requirements are required" };
    }

    for (const [i, r] of requirements.entries()) {
      if (!r || typeof r !== "object") {
        return { ok: false, status: 400, message: `rule[${i}] is invalid` };
      }
      if (!r.groupId || !r.subjectId || !r.teacherId) {
        return {
          ok: false,
          status: 400,
          message: `rule[${i}] requires groupId, subjectId, teacherId`,
        };
      }
      const lessons = Number((r as any).lessons);
      if (!Number.isFinite(lessons) || lessons < 1 || lessons > 2000) {
        return {
          ok: false,
          status: 400,
          message: `rule[${i}].lessons must be a positive number`,
        };
      }
    }

    const holidaysSet = new Set(
      (params.holidays ?? [])
        .map((d) => String(d).trim())
        .filter((d) => !!parseISODateOnlyToUTC(d)),
    );

    let workingDaysSet: Set<number> | null = null;
    if (Array.isArray(params.workingDays)) {
      const normalized = params.workingDays
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v) && v >= 0 && v <= 6);
      const unique = Array.from(new Set(normalized));
      if (!unique.length) {
        return {
          ok: false,
          status: 400,
          message: "workingDays must include at least one weekday (0..6)",
        };
      }
      workingDaysSet = new Set(unique);
    }

    const allDates = monthDatesUTC(year, month)
      .filter((d) =>
        workingDaysSet ? workingDaysSet.has(d.getUTCDay()) : true,
      )
      .map(toISODateOnlyUTC)
      .filter((d) => !holidaysSet.has(d));

    if (!allDates.length) {
      return { ok: false, status: 400, message: "No available days in month" };
    }

    const timeSlots = await prisma.timeSlot.findMany({
      where: { isBreak: false },
      select: { id: true, slotNumber: true },
      orderBy: { slotNumber: "asc" },
      take: 100,
    });

    if (!timeSlots.length) {
      return {
        ok: false,
        status: 400,
        message: "No TimeSlots configured in DB",
      };
    }

    const slotIndexById = new Map<string, number>();
    timeSlots.forEach((ts, idx) => slotIndexById.set(ts.id, idx));

    // Validate teacherUnavailable: must refer to valid DB timeSlotId and in-month date.
    const teacherUnavailable = Array.isArray(params.teacherUnavailable)
      ? params.teacherUnavailable
      : [];

    for (const [i, u] of teacherUnavailable.entries()) {
      if (!u?.teacherId || !u?.date || !u?.timeSlotId) {
        return {
          ok: false,
          status: 400,
          message: `teacherUnavailable[${i}] requires teacherId, date, timeSlotId`,
        };
      }
      if (!parseISODateOnlyToUTC(u.date)) {
        return {
          ok: false,
          status: 400,
          message: `teacherUnavailable[${i}].date is invalid`,
        };
      }
      if (!slotIndexById.has(u.timeSlotId)) {
        return {
          ok: false,
          status: 400,
          message: `teacherUnavailable[${i}].timeSlotId is not a valid DB TimeSlot`,
        };
      }
    }

    // Preload referenced entities for clearer errors.
    const groupIds = uniq(requirements.map((r) => r.groupId));
    const subjectIds = uniq(requirements.map((r) => r.subjectId));
    const teacherIds = uniq(requirements.map((r) => r.teacherId));
    const roomIds = uniq(
      requirements
        .map((r) =>
          r.roomId === null || r.roomId === undefined ? null : r.roomId,
        )
        .filter((x): x is string => typeof x === "string" && !!x.trim()),
    );

    const [dbGroups, dbSubjects, dbTeachers, dbRooms] = await Promise.all([
      prisma.group.findMany({
        where: { id: { in: groupIds } },
        select: { id: true },
      }),
      prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true },
      }),
      prisma.teacher.findMany({
        where: { id: { in: teacherIds } },
        select: { id: true },
      }),
      roomIds.length
        ? prisma.room.findMany({
            where: { id: { in: roomIds } },
            select: { id: true },
          })
        : Promise.resolve([] as Array<{ id: string }>),
    ]);

    const groupSet = new Set(dbGroups.map((x) => x.id));
    const subjectSet = new Set(dbSubjects.map((x) => x.id));
    const teacherSet = new Set(dbTeachers.map((x) => x.id));
    const roomSet = new Set(dbRooms.map((x) => x.id));

    const missing: string[] = [];
    for (const id of groupIds)
      if (!groupSet.has(id)) missing.push(`Group:${id}`);
    for (const id of subjectIds)
      if (!subjectSet.has(id)) missing.push(`Subject:${id}`);
    for (const id of teacherIds)
      if (!teacherSet.has(id)) missing.push(`Teacher:${id}`);
    for (const id of roomIds) if (!roomSet.has(id)) missing.push(`Room:${id}`);

    if (missing.length) {
      return {
        ok: false,
        status: 400,
        message: `Invalid references: ${missing.slice(0, 10).join(", ")}${
          missing.length > 10 ? " …" : ""
        }`,
      };
    }

    // Load existing schedules for the month/year to avoid overwriting.
    const existing = await prisma.schedule.findMany({
      where: { calendarDay: { year, month } },
      select: {
        groupId: true,
        teacherId: true,
        subjectId: true,
        roomId: true,
        timeSlotId: true,
        calendarDay: { select: { date: true } },
      },
      take: 50000,
    });

    const dayIndexByDate = new Map<string, number>();
    allDates.forEach((d, i) => dayIndexByDate.set(d, i));

    const pushBlocked = (
      bucket: Record<string, number[]>,
      key: string,
      dayIndex: number,
      slotIndex: number,
    ) => {
      const timeIndex = dayIndex * timeSlots.length + slotIndex;
      const list = bucket[key] ?? (bucket[key] = []);
      list.push(timeIndex);
    };

    const blockedTeacher: Record<string, number[]> = {};
    const blockedGroup: Record<string, number[]> = {};
    const blockedRoom: Record<string, number[]> = {};

    for (const r of existing) {
      const date = toISODateOnlyUTC(r.calendarDay.date);
      const dayIndex = dayIndexByDate.get(date);
      if (dayIndex === undefined) continue; // holiday or out-of-month view
      const slotIndex = slotIndexById.get(r.timeSlotId);
      if (slotIndex === undefined) continue;

      pushBlocked(blockedTeacher, r.teacherId, dayIndex, slotIndex);
      pushBlocked(blockedGroup, r.groupId, dayIndex, slotIndex);
      if (r.roomId) pushBlocked(blockedRoom, r.roomId, dayIndex, slotIndex);
    }

    for (const u of teacherUnavailable) {
      const dayIndex = dayIndexByDate.get(u.date);
      if (dayIndex === undefined) continue;
      const slotIndex = slotIndexById.get(u.timeSlotId);
      if (slotIndex === undefined) continue;
      pushBlocked(blockedTeacher, u.teacherId, dayIndex, slotIndex);
    }

    // Expand lesson instances.
    const lessons: Array<{
      ruleIndex: number;
      groupId: string;
      subjectId: string;
      teacherId: string;
      roomId: string | null;
      note: string | null;
    }> = [];

    requirements.forEach((r, ruleIndex) => {
      const count = Number(r.lessons);
      for (let i = 0; i < count; i += 1) {
        lessons.push({
          ruleIndex,
          groupId: r.groupId,
          subjectId: r.subjectId,
          teacherId: r.teacherId,
          roomId: r.roomId ?? null,
          note: r.note ?? null,
        });
      }
    });

    const solverPayload = {
      days: allDates.map((d) => ({ date: d })),
      timeSlots: timeSlots.map((ts) => ({
        id: ts.id,
        slotNumber: ts.slotNumber,
      })),
      lessons,
      blocked: {
        teacher: blockedTeacher,
        group: blockedGroup,
        room: blockedRoom,
      },
      options: {
        maxSeconds: params.maxSeconds ?? 12,
        workers: 8,
      },
    };

    try {
      const result = await runPythonSolver(solverPayload);
      if (!result?.ok) {
        return {
          ok: false,
          status: 409,
          message: result?.error?.message ?? "No feasible schedule found",
        };
      }

      const generatedLessons = (result.generatedLessons ??
        []) as AiGeneratedLesson[];
      if (!Array.isArray(generatedLessons) || !generatedLessons.length) {
        return {
          ok: false,
          status: 409,
          message: "Solver returned no lessons",
        };
      }

      // Safety: only real DB time slots.
      for (const [i, gl] of generatedLessons.entries()) {
        if (String(gl.timeSlotId).startsWith("missing:")) {
          return {
            ok: false,
            status: 500,
            message: `Solver produced invalid synthetic timeSlotId at index ${i}`,
          };
        }
        if (!slotIndexById.has(gl.timeSlotId)) {
          return {
            ok: false,
            status: 500,
            message: `Solver produced unknown timeSlotId at index ${i}`,
          };
        }
      }

      return { ok: true, generatedLessons };
    } catch (err: any) {
      return {
        ok: false,
        status: 500,
        message: err?.message ?? "AI solver failed",
      };
    }
  }
}
