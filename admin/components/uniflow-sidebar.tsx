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

  const academicItems = [
    {
      name: dict?.nav?.students ?? "Students",
      url: `${dashboardBase}/students`,
      icon: UsersIcon,
    },
    {
      name: dict?.nav?.teachers ?? "Teachers",
      url: `${dashboardBase}/teachers`,
      icon: GraduationCapIcon,
    },
    {
      name: dict?.nav?.groups ?? "Groups",
      url: `${dashboardBase}/groups`,
      icon: LayersIcon,
    },
    {
      name: dict?.nav?.parentGroups ?? "Department Groups",
      url: `${dashboardBase}/parent-groups`,
      icon: LayersIcon,
    },
  ];

  const learningItems = [
    {
      name: dict?.nav?.subjects ?? "Subjects",
      url: `${dashboardBase}/subjects`,
      icon: BookOpenIcon,
    },
    {
      name: dict?.nav?.classrooms ?? "Classrooms",
      url: `${dashboardBase}/classrooms`,
      icon: BookOpenIcon,
    },
    {
      name: dict?.nav?.schedule ?? "Schedule",
      url: `${dashboardBase}/schedule`,
      icon: CalendarIcon,
    },
  ];

  const analyticsItems = [
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
  ];

  const systemItems = [
    {
      name: dict?.nav?.settings ?? "Settings",
      url: `${dashboardBase}/settings`,
      icon: SettingsIcon,
    },
  ];

  const aiSubItems = [
    {
      title: dict?.nav?.aiMonitor ?? "AI Monitor",
      url: `${dashboardBase}/ai-monitor`,
      icon: BrainIcon,
    },
    {
      title: dict?.nav?.testAi ?? "Test AI",
      url: `${dashboardBase}/testai`,
      icon: BrainIcon,
    },
    {
      title: dict?.nav?.aiModels ?? "AI Models",
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

  const isAcademicActive = academicItems.some(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );
  const isLearningActive = learningItems.some(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );
  const isAnalyticsActive = analyticsItems.some(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );
  const isSystemActive = systemItems.some(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );
  const isSheetsActive = pathname.startsWith(`${dashboardBase}/sheets`);
  const isAiActive =
    pathname.startsWith(`${dashboardBase}/ai-monitor`) ||
    pathname.startsWith(`${dashboardBase}/testai`) ||
    pathname.startsWith(`${dashboardBase}/ai-models`);

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
          <SidebarMenu>
            <Collapsible
              asChild
              defaultOpen={isAcademicActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Academic"
                    isActive={isAcademicActive}
                  >
                    <GraduationCapIcon />
                    <span>Academic</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {academicItems.map((item) => (
                      <SidebarMenuSubItem key={item.name}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === item.url ||
                            pathname.startsWith(item.url + "/")
                          }
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible
              asChild
              defaultOpen={isLearningActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Learning"
                    isActive={isLearningActive}
                  >
                    <BookOpenIcon />
                    <span>Learning</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {learningItems.map((item) => (
                      <SidebarMenuSubItem key={item.name}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === item.url ||
                            pathname.startsWith(item.url + "/")
                          }
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible
              asChild
              defaultOpen={isAnalyticsActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip="Analytics"
                    isActive={isAnalyticsActive}
                  >
                    <ClipboardListIcon />
                    <span>Analytics</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {analyticsItems.map((item) => (
                      <SidebarMenuSubItem key={item.name}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === item.url ||
                            pathname.startsWith(item.url + "/")
                          }
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible
              asChild
              defaultOpen={isSystemActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="System" isActive={isSystemActive}>
                    <SettingsIcon />
                    <span>System</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {systemItems.map((item) => (
                      <SidebarMenuSubItem key={item.name}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === item.url ||
                            pathname.startsWith(item.url + "/")
                          }
                        >
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <Collapsible
              asChild
              defaultOpen={isAiActive}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={dict?.nav?.aiMonitor ?? "AI Settings"}
                    isActive={isAiActive}
                  >
                    <BrainIcon />
                    <span>{dict?.nav?.aiMonitor ?? "AI Settings"}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {aiSubItems.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={
                            pathname === subItem.url ||
                            pathname.startsWith(subItem.url + "/")
                          }
                        >
                          <Link href={subItem.url}>
                            <subItem.icon className="h-4 w-4" />
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

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
                            <subItem.icon className="h-4 w-4" />
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
