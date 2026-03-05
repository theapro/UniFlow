"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardCheck,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  lang: string;
  dict: any;
}

export function Sidebar({ lang, dict }: SidebarProps) {
  const pathname = usePathname();

  const routes = [
    {
      label: dict.nav.dashboard,
      icon: Home,
      href: `/${lang}/dashboard`,
      active: pathname === `/${lang}/dashboard`,
    },
    {
      label: dict.nav.students,
      icon: Users,
      href: `/${lang}/dashboard/students`,
      active: pathname.startsWith(`/${lang}/dashboard/students`),
    },
    {
      label: dict.nav.teachers,
      icon: GraduationCap,
      href: `/${lang}/dashboard/teachers`,
      active: pathname.startsWith(`/${lang}/dashboard/teachers`),
    },
    {
      label: dict.nav.subjects,
      icon: BookOpen,
      href: `/${lang}/dashboard/subjects`,
      active: pathname.startsWith(`/${lang}/dashboard/subjects`),
    },
    {
      label: dict.nav.schedule,
      icon: Calendar,
      href: `/${lang}/dashboard/schedule`,
      active: pathname.startsWith(`/${lang}/dashboard/schedule`),
    },
    {
      label: dict.nav.attendance,
      icon: ClipboardCheck,
      href: `/${lang}/dashboard/attendance`,
      active: pathname.startsWith(`/${lang}/dashboard/attendance`),
    },
    {
      label: dict.nav.aiMonitor,
      icon: Brain,
      href: `/${lang}/dashboard/ai-monitor`,
      active: pathname.startsWith(`/${lang}/dashboard/ai-monitor`),
    },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link
          href={`/${lang}/dashboard`}
          className="flex items-center gap-2 font-semibold"
        >
          <GraduationCap className="h-6 w-6" />
          <span>UniFlow Admin</span>
        </Link>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                route.active && "bg-muted text-primary",
              )}
            >
              <route.icon className="h-4 w-4" />
              {route.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
