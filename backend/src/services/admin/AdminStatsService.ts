import { prisma } from "../../config/prisma";
import { Role } from "@prisma/client";

export type StatsRange = "7d" | "30d" | "90d";

function rangeToDays(range: StatsRange): number {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class AdminStatsService {
  private roles(): Role[] {
    return [Role.STUDENT, Role.TEACHER, Role.STAFF, Role.MANAGER, Role.ADMIN];
  }

  async getLoginStatus(role: Role) {
    const [totalAccounts, loggedIn, neverLoggedIn] = await Promise.all([
      prisma.user.count({ where: { role } }),
      prisma.user.count({ where: { role, lastLoginAt: { not: null } } }),
      prisma.user.count({ where: { role, lastLoginAt: null } }),
    ]);

    // Relationship integrity: role must match linked profile.
    const [missingProfileLink, crossLinked] = await Promise.all([
      role === Role.STUDENT
        ? prisma.user.count({ where: { role, studentId: null } })
        : role === Role.TEACHER
          ? prisma.user.count({ where: { role, teacherId: null } })
          : Promise.resolve(0),
      role === Role.STUDENT
        ? prisma.user.count({ where: { role, teacherId: { not: null } } })
        : role === Role.TEACHER
          ? prisma.user.count({ where: { role, studentId: { not: null } } })
          : Promise.resolve(0),
    ]);

    return {
      role,
      totalAccounts,
      loggedIn,
      neverLoggedIn,
      integrity: {
        missingProfileLink,
        crossLinked,
      },
    };
  }

  async getSummary() {
    const roles = this.roles();

    const [
      accountsTotal,
      studentsTotal,
      teachersTotal,
      groupsTotal,
      cohortsTotal,
      subjectsTotal,
      roomsTotal,
      timeSlotsTotal,
      lessonsTotal,
      schedulesTotal,
      perRole,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.group.count(),
      prisma.cohort.count(),
      prisma.subject.count(),
      prisma.room.count(),
      prisma.timeSlot.count(),
      prisma.lesson.count(),
      prisma.schedule.count(),
      Promise.all(roles.map((r) => this.getLoginStatus(r))),
    ]);

    const byRole: Record<Role, number> = {
      [Role.STUDENT]: 0,
      [Role.TEACHER]: 0,
      [Role.STAFF]: 0,
      [Role.MANAGER]: 0,
      [Role.ADMIN]: 0,
    };
    const loggedInByRole: Record<Role, number> = {
      [Role.STUDENT]: 0,
      [Role.TEACHER]: 0,
      [Role.STAFF]: 0,
      [Role.MANAGER]: 0,
      [Role.ADMIN]: 0,
    };
    const neverLoggedInByRole: Record<Role, number> = {
      [Role.STUDENT]: 0,
      [Role.TEACHER]: 0,
      [Role.STAFF]: 0,
      [Role.MANAGER]: 0,
      [Role.ADMIN]: 0,
    };

    for (const row of perRole) {
      byRole[row.role] = row.totalAccounts;
      loggedInByRole[row.role] = row.loggedIn;
      neverLoggedInByRole[row.role] = row.neverLoggedIn;
    }

    const integrity = {
      studentAccountsMissingStudentId:
        perRole.find((r) => r.role === Role.STUDENT)?.integrity
          .missingProfileLink ?? 0,
      teacherAccountsMissingTeacherId:
        perRole.find((r) => r.role === Role.TEACHER)?.integrity
          .missingProfileLink ?? 0,
      studentAccountsWithTeacherId:
        perRole.find((r) => r.role === Role.STUDENT)?.integrity.crossLinked ??
        0,
      teacherAccountsWithStudentId:
        perRole.find((r) => r.role === Role.TEACHER)?.integrity.crossLinked ??
        0,
    };

    // Backward-compatible alias (avoid breaking older consumers)
    const usersEverLoggedIn =
      loggedInByRole[Role.STUDENT] +
      loggedInByRole[Role.TEACHER] +
      loggedInByRole[Role.STAFF] +
      loggedInByRole[Role.MANAGER] +
      loggedInByRole[Role.ADMIN];
    const usersNeverLoggedIn =
      neverLoggedInByRole[Role.STUDENT] +
      neverLoggedInByRole[Role.TEACHER] +
      neverLoggedInByRole[Role.STAFF] +
      neverLoggedInByRole[Role.MANAGER] +
      neverLoggedInByRole[Role.ADMIN];

    const now = new Date();
    const activeSince = new Date(now);
    activeSince.setDate(activeSince.getDate() - 30);
    const usersActive30d = await prisma.user.count({
      where: { lastLoginAt: { gte: activeSince } },
    });

    return {
      accounts: {
        total: accountsTotal,
        byRole,
        loggedInByRole,
        neverLoggedInByRole,
      },
      integrity,
      entities: {
        students: studentsTotal,
        teachers: teachersTotal,
        groups: groupsTotal,
        cohorts: cohortsTotal,
        subjects: subjectsTotal,
        rooms: roomsTotal,
        timeSlots: timeSlotsTotal,
        lessons: lessonsTotal,
        schedules: schedulesTotal,
      },
      users: {
        total: accountsTotal,
        active30d: usersActive30d,
        everLoggedIn: usersEverLoggedIn,
        neverLoggedIn: usersNeverLoggedIn,
      },
    };
  }

  async getUserActivity(range: StatsRange) {
    const days = rangeToDays(range);

    const users = await prisma.user.findMany({
      select: { lastLoginAt: true },
    });

    const totalUsers = users.length;
    const todayUtc = startOfUtcDay(new Date());

    const series: Array<{ date: string; active: number; inactive: number }> =
      [];

    // Rolling window: active = users who logged in within the last N days.
    for (let i = days - 1; i >= 0; i -= 1) {
      const dayStart = addUtcDays(todayUtc, -i);
      const dayEnd = addUtcDays(dayStart, 1);
      const windowStart = addUtcDays(dayEnd, -days);

      let active = 0;
      for (const u of users) {
        const last = u.lastLoginAt;
        if (!last) continue;
        if (last >= windowStart && last < dayEnd) active += 1;
      }
      series.push({
        date: toIsoDate(dayStart),
        active,
        inactive: Math.max(0, totalUsers - active),
      });
    }

    const now = new Date();
    const nowWindowStart = new Date(now);
    nowWindowStart.setDate(nowWindowStart.getDate() - days);

    const activeNow = users.reduce((acc, u) => {
      const last = u.lastLoginAt;
      return last && last >= nowWindowStart ? acc + 1 : acc;
    }, 0);

    return {
      range,
      totalUsers,
      activeNow,
      inactiveNow: Math.max(0, totalUsers - activeNow),
      series,
    };
  }
}
