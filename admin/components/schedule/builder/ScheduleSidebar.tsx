"use client";

import { useMemo, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { IdName, Teacher } from "./types";
import {
  ClassroomCard,
  GroupCard,
  SubjectCard,
  TeacherCard,
} from "./ScheduleCards";

type DepartmentGroupCategory =
  | "it"
  | "japanese"
  | "partner_university"
  | "language_university";

const DEPARTMENT_GROUP_CATEGORIES: Array<{
  key: DepartmentGroupCategory;
  label: string;
}> = [
  { key: "it", label: "IT" },
  { key: "japanese", label: "Japanese" },
  { key: "partner_university", label: "Partner university" },
  { key: "language_university", label: "Language university" },
];

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

  const [selectedGroupIdsByCategory, setSelectedGroupIdsByCategory] = useState<
    Record<DepartmentGroupCategory, string[]>
  >({
    it: [],
    japanese: [],
    partner_university: [],
    language_university: [],
  });
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const [resetSubjectSelectKey, setResetSubjectSelectKey] = useState(0);
  const [resetTeacherSelectKey, setResetTeacherSelectKey] = useState(0);
  const [resetRoomSelectKey, setResetRoomSelectKey] = useState(0);

  const sortedGroups = useMemo(
    () => [...props.groups].sort((a, b) => a.name.localeCompare(b.name)),
    [props.groups],
  );

  function toggleGroupInDepartment(
    category: DepartmentGroupCategory,
    id: string,
  ) {
    setSelectedGroupIdsByCategory((prev) => {
      const isSelected = prev[category].includes(id);

      const next: Record<DepartmentGroupCategory, string[]> = {
        it: prev.it.filter((x) => x !== id),
        japanese: prev.japanese.filter((x) => x !== id),
        partner_university: prev.partner_university.filter((x) => x !== id),
        language_university: prev.language_university.filter((x) => x !== id),
      };

      if (!isSelected) next[category] = [...next[category], id];

      return next;
    });
  }

  return (
    <div className={cn("h-full", props.className)}>
      <div className="space-y-6 pb-4">
        <SidebarSection
          title="Category Groups"
          hint="Select and drag into rows"
        >
          <div className="space-y-5">
            {DEPARTMENT_GROUP_CATEGORIES.map((cat) => {
              const options = sortedGroups;
              const selectedIds = selectedGroupIdsByCategory[cat.key];

              return (
                <div key={cat.key} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {cat.label}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start"
                      >
                        Select groups
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72" align="start">
                      <DropdownMenuLabel>{cat.label}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <div className="max-h-64 overflow-auto">
                        {options.length ? (
                          options.map((g) => (
                            <DropdownMenuCheckboxItem
                              key={g.id}
                              checked={selectedIds.includes(g.id)}
                              onCheckedChange={() =>
                                toggleGroupInDepartment(cat.key, g.id)
                              }
                              onSelect={(e) => e.preventDefault()}
                            >
                              {g.name}
                            </DropdownMenuCheckboxItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            No groups
                          </div>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="mt-2 grid gap-2">
                    {selectedIds
                      .map((id) => groupsById.get(id))
                      .filter(Boolean)
                      .map((g) => (
                        <GroupCard
                          key={g!.id}
                          id={g!.id}
                          name={g!.name}
                          className="w-full justify-start"
                          draggableId={`sidebar:group:${g!.id}`}
                          dragData={{ type: "group", groupId: g!.id }}
                        />
                      ))}

                    {!selectedIds.length ? (
                      <div className="text-xs text-muted-foreground">
                        No groups selected
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarSection>

        <SidebarSection title="Subjects" hint="Select and drag">
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
                No subjects selected
              </div>
            ) : null}
          </div>
        </SidebarSection>

        <SidebarSection title="Teachers" hint="Select and drag">
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
                No teachers selected
              </div>
            ) : null}
          </div>
        </SidebarSection>

        <SidebarSection title="Classrooms" hint="Select and drag">
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
                No classrooms selected
              </div>
            ) : null}
          </div>
        </SidebarSection>
      </div>
    </div>
  );
}
