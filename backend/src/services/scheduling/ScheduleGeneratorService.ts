import type { Weekday } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { logInfo, logWarn } from "../../utils/logger";

type SubjectWithTeachers = {
  id: string;
  name: string;
  weeklyLessons: number;
  teachers: Array<{ id: string }>;
};

type GroupLite = {
  id: string;
  name: string;
  cohortId: string | null;
  parentGroupId: string | null;
};

type LessonInstance = {
  groupId: string;
  groupName: string;
  subjectId: string;
  subjectName: string;
  weeklyLessons: number;
  teacherIds: string[];
};

type Placement = {
  weekday: Weekday;
  timeSlotId: string;
  groupId: string;
  teacherId: string;
  subjectId: string;
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

function weekdayKey(weekday: Weekday, timeSlotId: string) {
  return `${weekday}:${timeSlotId}`;
}

function groupSlotKey(groupId: string, weekday: Weekday, timeSlotId: string) {
  return `${groupId}:${weekday}:${timeSlotId}`;
}

export class ScheduleGeneratorService {
  private readonly defaultWeekdays: Weekday[] = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
  ];

  async clearOldSchedule(params?: { weekdays?: Weekday[] }) {
    const weekdays = params?.weekdays?.length
      ? params.weekdays
      : this.defaultWeekdays;

    const deleted = await prisma.scheduleEntry.deleteMany({
      where: {
        weekday: { in: weekdays },
      },
    });

    return { deleted: deleted.count };
  }

  async generateSchedule(params?: {
    clearExisting?: boolean;
    weekdays?: Weekday[];
    maxAttempts?: number;
    dryRun?: boolean;
  }): Promise<{ success: true; totalLessonsCreated: number }> {
    const clearExisting = params?.clearExisting ?? true;
    const weekdays = params?.weekdays?.length
      ? params.weekdays
      : this.defaultWeekdays;
    const maxAttempts = Math.max(1, Math.min(50, params?.maxAttempts ?? 25));
    const dryRun = params?.dryRun ?? false;

    const [timeSlots, groups, subjects] = await Promise.all([
      prisma.timeSlot.findMany({
        where: { isBreak: false },
        select: { id: true, slotNumber: true },
        orderBy: { slotNumber: "asc" },
        take: 50,
      }),
      prisma.group.findMany({
        select: { id: true, name: true, cohortId: true, parentGroupId: true },
        orderBy: { name: "asc" },
        take: 1000,
      }),
      prisma.subject.findMany({
        select: {
          id: true,
          name: true,
          weeklyLessons: true,
          cohortId: true,
          parentGroupId: true,
          teachers: { select: { id: true }, take: 20 },
        },
        take: 2000,
      }),
    ]);

    if (!timeSlots.length) {
      throw new Error("No TimeSlots configured in DB");
    }
    if (!groups.length) {
      return { success: true, totalLessonsCreated: 0 };
    }

    const subjectsByCohort = new Map<string, SubjectWithTeachers[]>();
    const subjectsByParentGroup = new Map<string, SubjectWithTeachers[]>();

    for (const s of subjects) {
      if (s.cohortId) {
        const list = subjectsByCohort.get(s.cohortId) ?? [];
        list.push(s);
        subjectsByCohort.set(s.cohortId, list);
      }
      if (s.parentGroupId) {
        const list = subjectsByParentGroup.get(s.parentGroupId) ?? [];
        list.push(s);
        subjectsByParentGroup.set(s.parentGroupId, list);
      }
    }

    const lessonInstances: LessonInstance[] = [];
    const groupsLite = groups as GroupLite[];

    for (const g of groupsLite) {
      const fromCohort = g.cohortId
        ? (subjectsByCohort.get(g.cohortId) ?? [])
        : [];
      const fromParent = g.parentGroupId
        ? (subjectsByParentGroup.get(g.parentGroupId) ?? [])
        : [];
      const groupSubjects = uniq([...fromCohort, ...fromParent]);

      for (const s of groupSubjects) {
        const weeklyLessons = Number((s as any).weeklyLessons ?? 0);
        if (!Number.isFinite(weeklyLessons) || weeklyLessons <= 0) continue;

        const teacherIds = uniq((s.teachers ?? []).map((t) => t.id)).filter(
          Boolean,
        );
        if (!teacherIds.length) {
          // Cannot schedule a subject without any teacher.
          logWarn("ScheduleGenerator", "Skipping subject without teachers", {
            groupId: g.id,
            groupName: g.name,
            subjectId: s.id,
            subjectName: s.name,
          });
          continue;
        }

        for (let i = 0; i < weeklyLessons; i++) {
          lessonInstances.push({
            groupId: g.id,
            groupName: g.name,
            subjectId: s.id,
            subjectName: s.name,
            weeklyLessons,
            teacherIds,
          });
        }
      }
    }

    if (!lessonInstances.length) {
      return { success: true, totalLessonsCreated: 0 };
    }

    // Harder items first: fewer teacher options, then higher weeklyLessons.
    lessonInstances.sort((a, b) => {
      const t = a.teacherIds.length - b.teacherIds.length;
      if (t !== 0) return t;
      return b.weeklyLessons - a.weeklyLessons;
    });

    const attemptPlanBase = [...lessonInstances];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const plan = [...attemptPlanBase];
      // Add mild randomness after first attempt.
      if (attempt > 1) shuffleInPlace(plan);

      const groupUsed = new Set<string>();
      const teacherUsed = new Map<string, Set<string>>();
      const groupDayLoad = new Map<string, Map<Weekday, number>>();
      const groupSubjectDayLoad = new Map<string, Map<Weekday, number>>();
      const teacherTotalLoad = new Map<string, number>();

      const placements: Placement[] = [];

      const incGroupDay = (groupId: string, weekday: Weekday) => {
        const byDay = groupDayLoad.get(groupId) ?? new Map<Weekday, number>();
        byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
        groupDayLoad.set(groupId, byDay);
      };

      const incGroupSubjectDay = (
        groupId: string,
        subjectId: string,
        weekday: Weekday,
      ) => {
        const key = `${groupId}:${subjectId}`;
        const byDay =
          groupSubjectDayLoad.get(key) ?? new Map<Weekday, number>();
        byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
        groupSubjectDayLoad.set(key, byDay);
      };

      const getGroupDay = (groupId: string, weekday: Weekday) =>
        groupDayLoad.get(groupId)?.get(weekday) ?? 0;
      const getGroupSubjectDay = (
        groupId: string,
        subjectId: string,
        weekday: Weekday,
      ) =>
        groupSubjectDayLoad.get(`${groupId}:${subjectId}`)?.get(weekday) ?? 0;

      const isTeacherFree = (
        teacherId: string,
        weekday: Weekday,
        timeSlotId: string,
      ) => {
        const key = weekdayKey(weekday, timeSlotId);
        const used = teacherUsed.get(key);
        return used ? !used.has(teacherId) : true;
      };

      const markTeacherUsed = (
        teacherId: string,
        weekday: Weekday,
        timeSlotId: string,
      ) => {
        const key = weekdayKey(weekday, timeSlotId);
        const used = teacherUsed.get(key) ?? new Set<string>();
        used.add(teacherId);
        teacherUsed.set(key, used);
      };

      const chooseTeacherForSlot = (
        teacherIds: string[],
        weekday: Weekday,
        timeSlotId: string,
      ) => {
        let best: string | null = null;
        let bestLoad = Number.POSITIVE_INFINITY;

        for (const teacherId of teacherIds) {
          if (!isTeacherFree(teacherId, weekday, timeSlotId)) continue;
          const load = teacherTotalLoad.get(teacherId) ?? 0;
          if (load < bestLoad) {
            bestLoad = load;
            best = teacherId;
          }
        }

        return best;
      };

      let failed = false;

      for (const inst of plan) {
        // Prefer spreading the same subject across different days,
        // and keep per-group day load balanced.
        const weekdaysOrdered = [...weekdays].sort((a, b) => {
          const aSub = getGroupSubjectDay(inst.groupId, inst.subjectId, a);
          const bSub = getGroupSubjectDay(inst.groupId, inst.subjectId, b);
          if (aSub !== bSub) return aSub - bSub;

          const aDay = getGroupDay(inst.groupId, a);
          const bDay = getGroupDay(inst.groupId, b);
          if (aDay !== bDay) return aDay - bDay;

          return Math.random() - 0.5;
        });

        let placed: Placement | null = null;

        for (const wd of weekdaysOrdered) {
          // Rotate slot scan each attempt a bit.
          const slotStart = attempt % timeSlots.length;
          for (let i = 0; i < timeSlots.length; i++) {
            const ts = timeSlots[(slotStart + i) % timeSlots.length]!;
            const gKey = groupSlotKey(inst.groupId, wd, ts.id);
            if (groupUsed.has(gKey)) continue;

            const teacherId = chooseTeacherForSlot(inst.teacherIds, wd, ts.id);
            if (!teacherId) continue;

            placed = {
              weekday: wd,
              timeSlotId: ts.id,
              groupId: inst.groupId,
              teacherId,
              subjectId: inst.subjectId,
            };
            break;
          }
          if (placed) break;
        }

        if (!placed) {
          failed = true;
          break;
        }

        // Commit placement into occupancy structures
        groupUsed.add(
          groupSlotKey(placed.groupId, placed.weekday, placed.timeSlotId),
        );
        markTeacherUsed(placed.teacherId, placed.weekday, placed.timeSlotId);
        teacherTotalLoad.set(
          placed.teacherId,
          (teacherTotalLoad.get(placed.teacherId) ?? 0) + 1,
        );
        incGroupDay(placed.groupId, placed.weekday);
        incGroupSubjectDay(placed.groupId, placed.subjectId, placed.weekday);
        placements.push(placed);
      }

      if (failed) {
        logInfo("ScheduleGenerator", "attempt failed", {
          attempt,
          maxAttempts,
          placed: placements.length,
          target: plan.length,
        });
        continue;
      }

      logInfo("ScheduleGenerator", "attempt succeeded", {
        attempt,
        total: placements.length,
      });

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          if (clearExisting) {
            await tx.scheduleEntry.deleteMany({
              where: {
                weekday: { in: weekdays },
              },
            });
          }

          if (placements.length) {
            await tx.scheduleEntry.createMany({
              data: placements.map((p) => ({
                weekday: p.weekday,
                groupId: p.groupId,
                teacherId: p.teacherId,
                subjectId: p.subjectId,
                timeSlotId: p.timeSlotId,
                roomId: null,
                effectiveFrom: null,
                effectiveTo: null,
              })),
            });
          }
        });
      }

      return { success: true, totalLessonsCreated: placements.length };
    }

    throw new Error(
      `Failed to generate a conflict-free schedule after ${maxAttempts} attempts`,
    );
  }
}
