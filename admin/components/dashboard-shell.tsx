"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { UniFlowSidebar } from "@/components/uniflow-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { ScheduleBuilderProvider } from "@/components/schedule/builder/route/ScheduleBuilderProvider";
import { ScheduleBuilderSidebar } from "@/components/schedule/builder/route/ScheduleBuilderSidebar";

export function DashboardShell(props: {
  lang: string;
  dict: any;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month");

  const scheduleMode = useMemo(() => {
    const manageBase = `/${props.lang}/dashboard/schedule/manage`;
    const viewBase = `/${props.lang}/dashboard/schedule/view`;
    const isManage =
      pathname === manageBase || pathname.startsWith(manageBase + "/");
    const isView = pathname === viewBase || pathname.startsWith(viewBase + "/");
    return isManage ? ("manage" as const) : isView ? ("view" as const) : null;
  }, [pathname, props.lang]);

  if (scheduleMode) {
    return (
      <ScheduleBuilderProvider
        readOnly={scheduleMode === "view"}
        initialMonth={monthParam}
      >
        <SidebarProvider>
          <ScheduleBuilderSidebar variant="inset" lang={props.lang} />
          <SidebarInset>
            <SiteHeader title={props.dict?.nav?.schedule ?? "Schedule"} />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                  {props.children}
                </div>
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </ScheduleBuilderProvider>
    );
  }

  return (
    <SidebarProvider>
      <UniFlowSidebar variant="inset" lang={props.lang} dict={props.dict} />
      <SidebarInset>
        <SiteHeader title={props.dict?.nav?.dashboard ?? "Dashboard"} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              {props.children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
