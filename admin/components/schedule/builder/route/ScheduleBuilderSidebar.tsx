"use client";

import Link from "next/link";
import { ArrowLeft, LayoutGrid } from "lucide-react";

import { Input } from "@/components/ui/input";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

import { cn } from "@/lib/utils";

import { useScheduleBuilder } from "./ScheduleBuilderContext";
import { ScheduleSidebar } from "../ScheduleSidebar";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function ScheduleBuilderSidebar({
  lang,
  className,
  ...props
}: {
  lang: string;
  className?: string;
} & React.ComponentProps<typeof Sidebar>) {
  const {
    subjects,
    teachers,
    classrooms,
    groups,
    firstLessonDate,
    setFirstLessonDate,
    month,
    year,
    loadingMeta,
    loadingGrid,
  } = useScheduleBuilder();

  const rightLabel =
    loadingMeta || loadingGrid ? "Loading…" : `Month: ${year}-${pad2(month)}`;

  return (
    <Sidebar collapsible="offcanvas" className={cn(className)} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={`/${lang}/dashboard/schedule`}>
                <ArrowLeft className="h-4 w-4" />
                <span className="text-base font-semibold">Schedule</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <SidebarGroupLabel>Builder</SidebarGroupLabel>
          <div className="px-2 pb-2 text-xs text-muted-foreground">
            Drag Groups into the header to add columns.
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Start Date</SidebarGroupLabel>
          <div className="px-2 pb-2">
            <Input
              type="date"
              value={firstLessonDate}
              onChange={(e) => setFirstLessonDate(e.target.value)}
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {rightLabel}
            </div>
          </div>
        </SidebarGroup>

        <ScheduleSidebar
          groups={groups}
          subjects={subjects}
          teachers={teachers}
          classrooms={classrooms}
          className="px-2"
        />

        <div className="mt-auto px-2 pb-2 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span>Excel-like workspace</span>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
