"use client";

import Link from "next/link";
import {
  Users,
  UserSquare2,
  Layers,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  ArrowUpRight,
} from "lucide-react";
import { RoleLoginStatusChart } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { title: "Students", href: "students", icon: Users, color: "text-blue-400" },
  {
    title: "Teachers",
    href: "teachers",
    icon: UserSquare2,
    color: "text-emerald-400",
  },
  { title: "Groups", href: "groups", icon: Layers, color: "text-amber-400" },
  {
    title: "Schedule",
    href: "schedule",
    icon: CalendarDays,
    color: "text-purple-400",
  },
  {
    title: "Attendance",
    href: "attendance",
    icon: ClipboardCheck,
    color: "text-rose-400",
  },
  {
    title: "Grades",
    href: "grades",
    icon: GraduationCap,
    color: "text-indigo-400",
  },
];

export default function DashboardPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const base = `/${lang}/dashboard`;

  return (
    <div className="container max-w-7xl py-10 space-y-10 animate-in fade-in duration-700">
      {/* PRIMARY STATS (SectionCards - ichida statistika bor deb hisoblaymiz) */}
      <section>
        <SectionCards />
      </section>

      {/*  QUICK NAVIGATION (Modern Grid) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="px-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Direct Access
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {NAV_LINKS.map((link) => (
            <QuickLink
              key={link.href}
              title={link.title}
              href={`${base}/${link.href}`}
              icon={link.icon}
              iconColor={link.color}
            />
          ))}
        </div>
      </div>

      {/*  CHART (Major visualization) */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Activity Analysis
          </h3>
        </div>
        <div className="rounded-[32px] border border-white/5 bg-zinc-900/20 backdrop-blur-md overflow-hidden p-2">
          <RoleLoginStatusChart
            role="STUDENT"
            title="Students Login Activity"
          />
        </div>
        <div className="rounded-[32px] border border-white/5 bg-zinc-900/20 backdrop-blur-md overflow-hidden p-2">
          <RoleLoginStatusChart
            role="TEACHER"
            title="Teachers Login Activity"
          />
        </div>
      </div>
    </div>
  );
}

// Sub-component for a cleaner Navigation Card
function QuickLink({ title, href, icon: Icon, iconColor }: any) {
  return (
    <Link href={href} className="group">
      <div className="relative h-32 rounded-[24px] border border-white/5 bg-zinc-900/20 p-5 transition-all duration-300 hover:bg-white/[0.03] hover:border-white/10 overflow-hidden">
        <div className="flex flex-col h-full justify-between">
          <div
            className={cn(
              "h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center transition-transform duration-500 group-hover:scale-110",
              iconColor,
            )}
          >
            <Icon size={20} strokeWidth={1.5} />
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-bold tracking-wide text-white/70 group-hover:text-primary transition-colors">
              {title}
            </p>
            <div className="flex items-center gap-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <span className="text-[9px] font-bold uppercase text-muted-foreground/40 tracking-tighter">
                Explore
              </span>
              <ArrowUpRight size={10} className="text-muted-foreground/40" />
            </div>
          </div>
        </div>

        {/* Subtle background decoration */}
        <Icon
          size={80}
          className="absolute -right-4 -bottom-4 opacity-[0.02] text-white rotate-12 group-hover:rotate-0 transition-transform duration-700"
        />
      </div>
    </Link>
  );
}
