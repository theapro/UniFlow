"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ScheduleSidebar } from "./ScheduleSidebar";
import { useScheduleBuilder } from "./route/ScheduleBuilderContext";
import { ScheduleBuilderProvider } from "./route/ScheduleBuilderProvider";
import { ScheduleWorkspace } from "./route/ScheduleWorkspace";

function LocalSidebarPanel() {
  const { groups, subjects, teachers, classrooms } = useScheduleBuilder();
  return (
    <ScheduleSidebar
      groups={groups}
      subjects={subjects}
      teachers={teachers}
      classrooms={classrooms}
    />
  );
}

export function ScheduleBuilder() {
  return (
    <ScheduleBuilderProvider>
      <Card>
        <CardHeader>
          <CardTitle>Schedule Builder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <LocalSidebarPanel />
            <ScheduleWorkspace />
          </div>
        </CardContent>
      </Card>
    </ScheduleBuilderProvider>
  );
}
