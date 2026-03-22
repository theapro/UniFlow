"use client";

import * as React from "react";
import { statsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Users2,
  UserMinus,
  GraduationCap,
  UserSquare2,
  Loader2,
} from "lucide-react";

type SummaryStats = {
  accounts: {
    total: number;
    byRole: {
      STUDENT: number;
      TEACHER: number;
      ADMIN: number;
    };
    loggedInByRole: {
      STUDENT: number;
      TEACHER: number;
      ADMIN: number;
    };
    neverLoggedInByRole: {
      STUDENT: number;
      TEACHER: number;
      ADMIN: number;
    };
  };
  integrity?: {
    studentAccountsMissingStudentId: number;
    teacherAccountsMissingTeacherId: number;
    studentAccountsWithTeacherId: number;
    teacherAccountsWithStudentId: number;
  };
  entities: {
    students: number;
    teachers: number;
    groups: number;
    cohorts: number;
    subjects: number;
    rooms: number;
    timeSlots: number;
    lessons: number;
    schedules: number;
  };
};

export function SectionCards() {
  const [summary, setSummary] = React.useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    statsApi
      .summary()
      .then((res) => {
        if (!mounted) return;
        setSummary(res.data.data as SummaryStats);
        setIsLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-1">
      <StatCard
        label="Total Accounts"
        value={summary?.accounts.total}
        subValue={
          summary
            ? `Students ${summary.accounts.byRole.STUDENT} • Teachers ${summary.accounts.byRole.TEACHER} • Admins ${summary.accounts.byRole.ADMIN}`
            : "..."
        }
        icon={Users2}
        isLoading={isLoading}
      />
      <StatCard
        label="Students Accounts"
        value={summary?.accounts.byRole.STUDENT}
        subValue={
          summary
            ? `Logged in ${summary.accounts.loggedInByRole.STUDENT} • Never ${summary.accounts.neverLoggedInByRole.STUDENT}${summary.integrity?.studentAccountsMissingStudentId ? ` • Missing student link ${summary.integrity.studentAccountsMissingStudentId}` : ""}`
            : "..."
        }
        icon={UserMinus}
        isLoading={isLoading}
      />
      <StatCard
        label="Teachers Accounts"
        value={summary?.accounts.byRole.TEACHER}
        subValue={
          summary
            ? `Logged in ${summary.accounts.loggedInByRole.TEACHER} • Never ${summary.accounts.neverLoggedInByRole.TEACHER}${summary.integrity?.teacherAccountsMissingTeacherId ? ` • Missing teacher link ${summary.integrity.teacherAccountsMissingTeacherId}` : ""}`
            : "..."
        }
        icon={GraduationCap}
        isLoading={isLoading}
      />
      <StatCard
        label="Admin Accounts"
        value={summary?.accounts.byRole.ADMIN}
        subValue={
          summary
            ? `Logged in ${summary.accounts.loggedInByRole.ADMIN} • Never ${summary.accounts.neverLoggedInByRole.ADMIN}`
            : "..."
        }
        icon={UserSquare2}
        isLoading={isLoading}
      />
    </div>
  );
}

function StatCard({ label, value, subValue, icon: Icon, isLoading }: any) {
  return (
    <div className="group relative rounded-[32px] border border-white/5 bg-zinc-900/20 p-8 transition-all duration-500 hover:bg-white/[0.03] overflow-hidden">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 border border-white/10 group-hover:border-primary/20 transition-colors">
            <Icon className="h-5 w-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/30">
            Analytics
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/5" />
            ) : (
              <span className="text-4xl font-light tracking-tighter text-white/90 tabular-nums">
                {value ?? "—"}
              </span>
            )}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/20 uppercase tracking-tight">
            {subValue}
          </p>
        </div>
      </div>

      {/* Subtle corner glow */}
      <div className="absolute -right-4 -top-4 h-24 w-24 bg-primary/5 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
}
