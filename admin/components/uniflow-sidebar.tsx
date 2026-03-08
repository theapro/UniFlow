"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authApi } from "@/lib/api";

import {
  BookOpenIcon,
  BrainIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileSpreadsheet,
  LayoutDashboardIcon,
  UsersIcon,
  GraduationCapIcon,
  LayersIcon,
  SettingsIcon,
  ChevronRight,
} from "lucide-react";

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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function UniFlowSidebar({
  lang,
  dict,
  ...props
}: {
  lang: string;
  dict: any;
} & React.ComponentProps<typeof Sidebar>) {
  const dashboardBase = `/${lang}/dashboard`;
  const pathname = usePathname();
  const [user, setUser] = React.useState<any>(null);

  React.useEffect(() => {
    const storedUser = authApi.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const managementItems = [
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
      name: dict?.nav?.grades ?? "Grades",
      url: `${dashboardBase}/grades`,
      icon: ClipboardListIcon,
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
  ];

  const sheetsSubItems = [
    {
      title: "Students",
      url: `${dashboardBase}/sheets/students`,
      icon: UsersIcon,
    },
    {
      title: "Teachers",
      url: `${dashboardBase}/sheets/teachers`,
      icon: GraduationCapIcon,
    },
    {
      title: "Attendance",
      url: `${dashboardBase}/sheets/attendance`,
      icon: ClipboardCheckIcon,
    },
    {
      title: dict?.nav?.grades ?? "Grades",
      url: `${dashboardBase}/sheets/grades`,
      icon: ClipboardListIcon,
    },
  ];

  const isSheetsActive = pathname.startsWith(`${dashboardBase}/sheets`);

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

        <SidebarGroup>
          <SidebarGroupLabel>
            {dict?.nav?.management ?? "Management"}
          </SidebarGroupLabel>
          <SidebarMenu>
            {managementItems.map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === item.url || pathname.startsWith(item.url + "/")
                  }
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            <Collapsible
              asChild
              defaultOpen={isSheetsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={dict?.nav?.sheets ?? "Sheets"}
                    isActive={isSheetsActive}
                  >
                    <FileSpreadsheet />
                    <span>{dict?.nav?.sheets ?? "Sheets"}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {sheetsSubItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={pathname === subItem.url}
                        >
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroup>
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
