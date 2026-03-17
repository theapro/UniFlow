"use client";

import Link from "next/link";
import { ArrowLeft, Eye, Pencil } from "lucide-react";

import { Input } from "@/components/ui/input";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
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
    readOnly,
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
    setPageBusy,
  } = useScheduleBuilder();

  const rightLabel =
    loadingMeta || loadingGrid ? "Loading…" : `${year}-${pad2(month)}`;

  const monthValue = `${year}-${pad2(month)}`;

  return (
    <Sidebar collapsible="offcanvas" className={cn(className)} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="w-full">
            <div className="flex items-center gap-1">
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:!p-1.5 flex-1"
              >
                <Link href={`/${lang}/dashboard/schedule`}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-base font-semibold">Schedule</span>
                </Link>
              </SidebarMenuButton>

              <SidebarMenuButton
                asChild
                tooltip={readOnly ? "Back to manage" : "Open read-only view"}
                className="data-[slot=sidebar-menu-button]:!p-1.5 w-9 justify-center"
              >
                <Link
                  href={
                    readOnly
                      ? `/${lang}/dashboard/schedule/manage?month=${encodeURIComponent(monthValue)}`
                      : `/${lang}/dashboard/schedule/view?month=${encodeURIComponent(monthValue)}`
                  }
                  onClick={() =>
                    setPageBusy({
                      label: readOnly
                        ? "Opening manage mode…"
                        : "Opening read-only view…",
                    })
                  }
                  aria-label={
                    readOnly ? "Back to manage" : "Open read-only view"
                  }
                >
                  {readOnly ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {readOnly ? "Back to manage" : "Open read-only view"}
                  </span>
                </Link>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarGroup>
          <div className="pb-2 space-y-2">
            <div className=" flex items-center justify-between">

            <div className="text-sm font-semibold text-foreground">
              Start Date
            </div>
            <div className="text-xs text-muted-foreground">{rightLabel}</div>
            </div>
            <Input
              type="date"
              value={firstLessonDate}
              onChange={(e) => setFirstLessonDate(e.target.value)}
            />
          </div>
        </SidebarGroup>

        {!readOnly ? (
          <ScheduleSidebar
            groups={groups}
            subjects={subjects}
            teachers={teachers}
            classrooms={classrooms}
            className="px-2"
          />
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
