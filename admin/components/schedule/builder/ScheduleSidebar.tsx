"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { aiGroupsApi } from "@/lib/api";
import { cohortColorHsl } from "./utils/cohortColors";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import type { GroupMeta, IdName, Teacher } from "./types";
import {
  ClassroomCard,
  GroupCard,
  SubjectCard,
  TeacherCard,
} from "./ScheduleCards";
import { useScheduleBuilder } from "./route/ScheduleBuilderContext";
import { AIScheduleGeneratorModal } from "./AIScheduleGeneratorModal";

const FIXED_DEPARTMENT_ORDER = [
  "IT",
  "Japanese",
  "Partner University",
  "Employability/Cowork",
  "Language University",
] as const;

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
  groups: GroupMeta[];
  subjects: IdName[];
  teachers: Teacher[];
  classrooms: IdName[];
  className?: string;
}) {
  const {
    month,
    year,
    reloadGrid,
    readOnly,
    setPageBusy,
    maxPositionCount,
    setDepartmentGroupAssignments,
    setGroupOrder,
  } = useScheduleBuilder();
  const [aiModalOpen, setAiModalOpen] = useState(false);

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
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  const [resetSubjectSelectKey, setResetSubjectSelectKey] = useState(0);
  const [resetTeacherSelectKey, setResetTeacherSelectKey] = useState(0);
  const [resetRoomSelectKey, setResetRoomSelectKey] = useState(0);

  const groupsByDepartment = useMemo(() => {
    const out = new Map<string, GroupMeta[]>();
    for (const g of props.groups) {
      const deptName = g.parentGroup?.name
        ? String(g.parentGroup.name)
        : "(No department)";
      const list = out.get(deptName) ?? [];
      list.push(g);
      out.set(deptName, list);
    }
    return out;
  }, [props.groups]);

  const autoArrangeGroups = async () => {
    if (readOnly) return;

    setPageBusy({ label: "Arranging groups…" });
    try {
      const res = await aiGroupsApi.arrange({ maxColumns: maxPositionCount });
      const payload = res.data?.data;
      if (!payload?.assignments || !payload?.groupOrder) {
        toast.error("Invalid response from server");
        return;
      }

      setDepartmentGroupAssignments(payload.assignments as any);
      setGroupOrder(payload.groupOrder as Array<string | null>);
      toast.success(
        payload?.meta?.mode === "ai"
          ? "Groups arranged (AI)"
          : "Groups arranged",
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "Failed");
    } finally {
      setPageBusy(null);
    }
  };

  return (
    <div className={cn("h-full", props.className)}>
      <div className="space-y-6 pb-4">
        <SidebarSection
          title="Generate with AI"
          hint="Plan requirements in a modal"
        >
          <Button
            type="button"
            className="w-full"
            onClick={() => setAiModalOpen(true)}
          >
            Generate with AI
          </Button>

          <AIScheduleGeneratorModal
            open={aiModalOpen}
            onOpenChange={setAiModalOpen}
            defaultMonth={month}
            defaultYear={year}
            groups={props.groups}
            subjects={props.subjects}
            teachers={props.teachers}
            classrooms={props.classrooms}
            onGenerated={reloadGrid}
          />
        </SidebarSection>

        <SidebarSection title="Groups" hint="Drag groups into department rows">
          <div className="space-y-4">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={autoArrangeGroups}
              disabled={readOnly}
            >
              Auto add groups
            </Button>

            {FIXED_DEPARTMENT_ORDER.map((deptName) => {
              const deptGroups = (groupsByDepartment.get(deptName) ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));

              if (!deptGroups.length) return null;

              if (deptName === "Japanese") {
                return (
                  <Collapsible key={deptName} defaultOpen={false}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-center justify-between",
                          "rounded-md border bg-card px-3 py-2",
                          "text-xs font-medium text-foreground",
                        )}
                      >
                        <span>{deptName}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="grid gap-2">
                        {deptGroups.map((g) => (
                          <GroupCard
                            key={g.id}
                            id={g.id}
                            name={g.name}
                            className="w-full justify-start"
                            draggableId={`sidebar:group:${g.id}`}
                            dragData={{ type: "group", groupId: g.id }}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              const byCohort = new Map<
                string,
                { sortOrder: number; groups: GroupMeta[] }
              >();
              for (const g of deptGroups) {
                const code = g.cohort?.code
                  ? String(g.cohort.code)
                  : "(No cohort)";
                const sortOrder = Number(g.cohort?.sortOrder ?? 999);
                const entry = byCohort.get(code) ?? { sortOrder, groups: [] };
                entry.groups.push(g);
                entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
                byCohort.set(code, entry);
              }

              const cohortKeys = Array.from(byCohort.entries())
                .map(([code, v]) => ({ code, sortOrder: v.sortOrder }))
                .sort((a, b) => {
                  const r = a.sortOrder - b.sortOrder;
                  if (r !== 0) return r;
                  return a.code.localeCompare(b.code);
                });

              return (
                <Collapsible
                  key={deptName}
                  defaultOpen={deptName === "IT"}
                  className="space-y-2"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full flex items-center justify-between",
                        "rounded-md border bg-card px-3 py-2",
                        "text-xs font-medium text-foreground",
                      )}
                    >
                      <span>{deptName}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {cohortKeys.map((c, idx) => {
                      const groupsForCohort = (
                        byCohort.get(c.code)?.groups ?? []
                      )
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name));

                      return (
                        <Collapsible
                          key={`${deptName}:${c.code}`}
                          defaultOpen={deptName === "IT" && idx === 0}
                          className="space-y-2"
                        >
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "w-full flex items-center justify-between",
                                "rounded-md bg-muted/30 px-3 py-2",
                                "text-[11px] font-semibold text-foreground",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {deptName === "IT" ? (
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor:
                                        cohortColorHsl({
                                          code: c.code,
                                          sortOrder: byCohort.get(c.code)
                                            ?.sortOrder,
                                        }) ?? undefined,
                                    }}
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <span>{c.code}</span>
                              </span>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid gap-2">
                              {groupsForCohort.map((g) => (
                                <GroupCard
                                  key={g.id}
                                  id={g.id}
                                  name={g.name}
                                  className="w-full justify-start"
                                  draggableId={`sidebar:group:${g.id}`}
                                  dragData={{ type: "group", groupId: g.id }}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {Array.from(groupsByDepartment.keys())
              .filter(
                (name) =>
                  !FIXED_DEPARTMENT_ORDER.includes(name as any) &&
                  (groupsByDepartment.get(name)?.length ?? 0) > 0,
              )
              .sort((a, b) => a.localeCompare(b))
              .map((deptName) => {
                const deptGroups = (groupsByDepartment.get(deptName) ?? [])
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name));

                const byCohort = new Map<
                  string,
                  { sortOrder: number; groups: GroupMeta[] }
                >();
                for (const g of deptGroups) {
                  const code = g.cohort?.code
                    ? String(g.cohort.code)
                    : "(No cohort)";
                  const sortOrder = Number(g.cohort?.sortOrder ?? 999);
                  const entry = byCohort.get(code) ?? { sortOrder, groups: [] };
                  entry.groups.push(g);
                  entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
                  byCohort.set(code, entry);
                }

                const cohortKeys = Array.from(byCohort.entries())
                  .map(([code, v]) => ({ code, sortOrder: v.sortOrder }))
                  .sort((a, b) => {
                    const r = a.sortOrder - b.sortOrder;
                    if (r !== 0) return r;
                    return a.code.localeCompare(b.code);
                  });

                return (
                  <Collapsible key={deptName} defaultOpen={false}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-center justify-between",
                          "rounded-md border bg-card px-3 py-2",
                          "text-xs font-medium text-foreground",
                        )}
                      >
                        <span>{deptName}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 pt-2">
                      {cohortKeys.map((c) => {
                        const groupsForCohort = (
                          byCohort.get(c.code)?.groups ?? []
                        )
                          .slice()
                          .sort((a, b) => a.name.localeCompare(b.name));

                        return (
                          <Collapsible
                            key={`${deptName}:${c.code}`}
                            defaultOpen={false}
                            className="space-y-2"
                          >
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "w-full flex items-center justify-between",
                                  "rounded-md bg-muted/30 px-3 py-2",
                                  "text-[11px] font-semibold text-foreground",
                                )}
                              >
                                <span>{c.code}</span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="grid gap-2">
                                {groupsForCohort.map((g) => (
                                  <GroupCard
                                    key={g.id}
                                    id={g.id}
                                    name={g.name}
                                    className="w-full justify-start"
                                    draggableId={`sidebar:group:${g.id}`}
                                    dragData={{ type: "group", groupId: g.id }}
                                  />
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

            {!props.groups.length ? (
              <div className="text-xs text-muted-foreground">No groups</div>
            ) : null}
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
