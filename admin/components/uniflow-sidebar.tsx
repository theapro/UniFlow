"use client";

import * as React from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";

import {
  BookOpenIcon,
  BrainIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  FileSpreadsheet,
  LayoutDashboardIcon,
  UsersIcon,
  GraduationCapIcon,
  LayersIcon,
  SettingsIcon,
} from "lucide-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function UniFlowSidebar({
  lang,
  dict,
  ...props
}: {
  lang: string;
  dict: any;
} & React.ComponentProps<typeof Sidebar>) {
  const dashboardBase = `/${lang}/dashboard`;
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const storedUser = authApi.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={dashboardBase}>
                <GraduationCapIcon className="h-5 w-5" />
                <span className="text-base font-semibold">UniFlow</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain
          items={[
            {
              title: dict?.nav?.dashboard ?? "Dashboard",
              url: dashboardBase,
              icon: LayoutDashboardIcon,
            },
          ]}
        />

        <NavDocuments
          label={dict?.nav?.management ?? "Management"}
          items={[
            {
              name: dict?.nav?.students ?? "Students",
              url: `${dashboardBase}/students`,
              icon: UsersIcon,
            },
            {
              name: dict?.nav?.groups ?? "Groups",
              url: `${dashboardBase}/groups`,
              icon: LayersIcon,
            },
            {
              name: dict?.nav?.teachers ?? "Teachers",
              url: `${dashboardBase}/teachers`,
              icon: GraduationCapIcon,
            },
            {
              name: dict?.nav?.subjects ?? "Subjects",
              url: `${dashboardBase}/subjects`,
              icon: BookOpenIcon,
            },
            {
              name: dict?.nav?.schedule ?? "Schedule",
              url: `${dashboardBase}/schedule`,
              icon: CalendarIcon,
            },
            {
              name: dict?.nav?.attendance ?? "Attendance",
              url: `${dashboardBase}/attendance`,
              icon: ClipboardCheckIcon,
            },
            {
              name: dict?.nav?.aiMonitor ?? "AI Monitor",
              url: `${dashboardBase}/ai-monitor`,
              icon: BrainIcon,
            },
            {
              name: dict?.nav?.aiModels ?? "AI Models",
              url: `${dashboardBase}/ai-models`,
              icon: SettingsIcon,
            },
            {
              name: dict?.nav?.sheets ?? "Sheets",
              url: `${dashboardBase}/sheets`,
              icon: FileSpreadsheet,
            },
          ]}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          lang={lang}
          user={{
            name: user?.email?.split("@")[0] || "Admin",
            email: user?.email || "admin@uniflow",
            avatar: "/avatars/shadcn.jpg",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
