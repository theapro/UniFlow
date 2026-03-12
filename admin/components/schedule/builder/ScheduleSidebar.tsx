"use client";

import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { IdName, Teacher } from "./types";
import {
  ClassroomCard,
  GroupCard,
  SubjectCard,
  TeacherCard,
} from "./ScheduleCards";

function SidebarSection(props: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{props.title}</div>
      {props.hint ? (
        <div className="text-xs text-muted-foreground">{props.hint}</div>
      ) : null}
      {props.children}
    </div>
  );
}

export function ScheduleSidebar(props: {
  groups: IdName[];
  subjects: IdName[];
  teachers: Teacher[];
  classrooms: IdName[];
  className?: string;
}) {
  const groupsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const g of props.groups) map.set(g.id, g);
    return map;
  }, [props.groups]);

  const subjectsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const s of props.subjects) map.set(s.id, s);
    return map;
  }, [props.subjects]);

  const teachersById = useMemo(() => {
    const map = new Map<string, Teacher>();
    for (const t of props.teachers) map.set(t.id, t);
    return map;
  }, [props.teachers]);

  const classroomsById = useMemo(() => {
    const map = new Map<string, IdName>();
    for (const r of props.classrooms) map.set(r.id, r);
    return map;
  }, [props.classrooms]);

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const [resetGroupSelectKey, setResetGroupSelectKey] = useState(0);
  const [resetSubjectSelectKey, setResetSubjectSelectKey] = useState(0);
  const [resetTeacherSelectKey, setResetTeacherSelectKey] = useState(0);
  const [resetRoomSelectKey, setResetRoomSelectKey] = useState(0);

  return (
    <div className={cn("h-full", props.className)}>
      <ScrollArea className="h-full pr-3">
        <div className="space-y-6 pb-4">
          <SidebarSection
            title="Groups"
            hint="Select from dropdown, then drag into header"
          >
            <Select
              key={resetGroupSelectKey}
              onValueChange={(id) => {
                setSelectedGroupIds((prev) =>
                  prev.includes(id) ? prev : [...prev, id],
                );
                setResetGroupSelectKey((n) => n + 1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {props.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-wrap gap-2">
              {selectedGroupIds
                .map((id) => groupsById.get(id))
                .filter(Boolean)
                .map((g) => (
                  <GroupCard
                    key={g!.id}
                    id={g!.id}
                    name={g!.name}
                    draggableId={`sidebar:group:${g!.id}`}
                    dragData={{ type: "group", groupId: g!.id }}
                  />
                ))}
              {!selectedGroupIds.length ? (
                <div className="text-xs text-muted-foreground">
                  No selected groups
                </div>
              ) : null}
            </div>
          </SidebarSection>

          <SidebarSection title="Subjects" hint="Select and drag into a cell">
            <Select
              key={resetSubjectSelectKey}
              onValueChange={(id) => {
                setSelectedSubjectIds((prev) =>
                  prev.includes(id) ? prev : [...prev, id],
                );
                setResetSubjectSelectKey((n) => n + 1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {props.subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-wrap gap-2">
              {selectedSubjectIds
                .map((id) => subjectsById.get(id))
                .filter(Boolean)
                .map((s) => (
                  <SubjectCard
                    key={s!.id}
                    id={s!.id}
                    name={s!.name}
                    draggableId={`sidebar:subject:${s!.id}`}
                    dragData={{ type: "mini", kind: "subject", id: s!.id }}
                  />
                ))}
              {!selectedSubjectIds.length ? (
                <div className="text-xs text-muted-foreground">
                  No selected subjects
                </div>
              ) : null}
            </div>
          </SidebarSection>

          <SidebarSection title="Teachers" hint="Select and drag into a cell">
            <Select
              key={resetTeacherSelectKey}
              onValueChange={(id) => {
                setSelectedTeacherIds((prev) =>
                  prev.includes(id) ? prev : [...prev, id],
                );
                setResetTeacherSelectKey((n) => n + 1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {props.teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-wrap gap-2">
              {selectedTeacherIds
                .map((id) => teachersById.get(id))
                .filter(Boolean)
                .map((t) => (
                  <TeacherCard
                    key={t!.id}
                    id={t!.id}
                    fullName={t!.fullName}
                    draggableId={`sidebar:teacher:${t!.id}`}
                    dragData={{ type: "mini", kind: "teacher", id: t!.id }}
                  />
                ))}
              {!selectedTeacherIds.length ? (
                <div className="text-xs text-muted-foreground">
                  No selected teachers
                </div>
              ) : null}
            </div>
          </SidebarSection>

          <SidebarSection title="Classrooms" hint="Select and drag into a cell">
            <Select
              key={resetRoomSelectKey}
              onValueChange={(id) => {
                setSelectedRoomIds((prev) =>
                  prev.includes(id) ? prev : [...prev, id],
                );
                setResetRoomSelectKey((n) => n + 1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a classroom" />
              </SelectTrigger>
              <SelectContent>
                {props.classrooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-2 flex flex-wrap gap-2">
              {selectedRoomIds
                .map((id) => classroomsById.get(id))
                .filter(Boolean)
                .map((r) => (
                  <ClassroomCard
                    key={r!.id}
                    id={r!.id}
                    name={r!.name}
                    draggableId={`sidebar:room:${r!.id}`}
                    dragData={{ type: "mini", kind: "room", id: r!.id }}
                  />
                ))}
              {!selectedRoomIds.length ? (
                <div className="text-xs text-muted-foreground">
                  No selected classrooms
                </div>
              ) : null}
            </div>
          </SidebarSection>
        </div>
      </ScrollArea>
    </div>
  );
}
