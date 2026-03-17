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

import type { GroupMeta, IdName, SubjectMeta, Teacher } from "./types";
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
  subjects: SubjectMeta[];
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

  const formatCohortLabel = (c: { code?: string; year?: number | null }) => {
    const code = String(c.code ?? "").trim();
    const year = typeof c.year === "number" ? c.year : null;
    if (!code) return "(No cohort)";
    return year ? `${code} (${year})` : code;
  };

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
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);

  const [resetTeacherSelectKey, setResetTeacherSelectKey] = useState(0);

  const subjectsByDepartment = useMemo(() => {
    const out = new Map<string, SubjectMeta[]>();
    for (const s of props.subjects) {
      const deptName = s.parentGroup?.name
        ? String(s.parentGroup.name)
        : "(No department)";
      const list = out.get(deptName) ?? [];
      list.push(s);
      out.set(deptName, list);
    }
    return out;
  }, [props.subjects]);

  const classroomsByFloor = useMemo(() => {
    const parseFloor = (name: string): number | null => {
      const raw = String(name ?? "").trim();
      const m = /(^|\b)(\d{3})(\b|$)/.exec(raw);
      if (!m) return null;
      const n = Number(m[2]);
      if (!Number.isFinite(n) || n < 100 || n > 999) return null;
      const floor = Math.floor(n / 100);
      if (floor < 1 || floor > 9) return null;
      return floor;
    };

    const out = new Map<string, IdName[]>();
    for (const r of props.classrooms) {
      const floor = parseFloor(r.name);
      const key = floor ? `${floor}-qavat` : "Other";
      const list = out.get(key) ?? [];
      list.push(r);
      out.set(key, list);
    }

    // Sort: numeric floors first, then Other.
    const orderedKeys = Array.from(out.keys()).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      const na = Number(a.split("-")[0]);
      const nb = Number(b.split("-")[0]);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });

    for (const k of orderedKeys) {
      const list = out.get(k) ?? [];
      list.sort((a, b) => {
        const an = Number(a.name);
        const bn = Number(b.name);
        if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
        return a.name.localeCompare(b.name);
      });
      out.set(k, list);
    }

    return { byKey: out, orderedKeys };
  }, [props.classrooms]);

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
                { sortOrder: number; year: number | null; groups: GroupMeta[] }
              >();
              for (const g of deptGroups) {
                const code = g.cohort?.code
                  ? String(g.cohort.code)
                  : "(No cohort)";
                const sortOrder = Number(g.cohort?.sortOrder ?? 999);
                const year =
                  typeof g.cohort?.year === "number" ? g.cohort.year : null;
                const entry = byCohort.get(code) ?? {
                  sortOrder,
                  year,
                  groups: [],
                };
                entry.groups.push(g);
                entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
                entry.year = entry.year ?? year;
                byCohort.set(code, entry);
              }

              const cohortKeys = Array.from(byCohort.entries())
                .map(([code, v]) => ({
                  code,
                  sortOrder: v.sortOrder,
                  year: v.year,
                }))
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
                                <span>
                                  {c.code === "(No cohort)"
                                    ? c.code
                                    : formatCohortLabel({
                                        code: c.code,
                                        year: c.year,
                                      })}
                                </span>
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
                  {
                    sortOrder: number;
                    year: number | null;
                    groups: GroupMeta[];
                  }
                >();
                for (const g of deptGroups) {
                  const code = g.cohort?.code
                    ? String(g.cohort.code)
                    : "(No cohort)";
                  const sortOrder = Number(g.cohort?.sortOrder ?? 999);
                  const year =
                    typeof g.cohort?.year === "number" ? g.cohort.year : null;
                  const entry = byCohort.get(code) ?? {
                    sortOrder,
                    year,
                    groups: [],
                  };
                  entry.groups.push(g);
                  entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
                  entry.year = entry.year ?? year;
                  byCohort.set(code, entry);
                }

                const cohortKeys = Array.from(byCohort.entries())
                  .map(([code, v]) => ({
                    code,
                    sortOrder: v.sortOrder,
                    year: v.year,
                  }))
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
                                <span>
                                  {c.code === "(No cohort)"
                                    ? c.code
                                    : formatCohortLabel({
                                        code: c.code,
                                        year: c.year,
                                      })}
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

            {!props.groups.length ? (
              <div className="text-xs text-muted-foreground">No groups</div>
            ) : null}
          </div>
        </SidebarSection>

        <SidebarSection title="Subjects" hint="Drag subjects into lessons">
          <div className="space-y-2">
            {FIXED_DEPARTMENT_ORDER.map((deptName) => {
              const deptSubjects = (subjectsByDepartment.get(deptName) ?? [])
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name));
              if (!deptSubjects.length) return null;

              const byCohort = new Map<
                string,
                {
                  sortOrder: number;
                  year: number | null;
                  subjects: SubjectMeta[];
                }
              >();

              for (const s of deptSubjects) {
                const code = s.cohort?.code
                  ? String(s.cohort.code)
                  : "(No cohort)";
                const sortOrder = Number(s.cohort?.sortOrder ?? 999);
                const year =
                  typeof s.cohort?.year === "number" ? s.cohort.year : null;
                const entry = byCohort.get(code) ?? {
                  sortOrder,
                  year,
                  subjects: [],
                };
                entry.subjects.push(s);
                entry.sortOrder = Math.min(entry.sortOrder, sortOrder);
                entry.year = entry.year ?? year;
                byCohort.set(code, entry);
              }

              const cohortKeys = Array.from(byCohort.entries())
                .map(([code, v]) => ({
                  code,
                  sortOrder: v.sortOrder,
                  year: v.year,
                }))
                .sort((a, b) => {
                  const r = a.sortOrder - b.sortOrder;
                  if (r !== 0) return r;
                  return a.code.localeCompare(b.code);
                });

              return (
                <Collapsible key={deptName} defaultOpen={deptName === "IT"}>
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
                      const subjectsForCohort = (
                        byCohort.get(c.code)?.subjects ?? []
                      )
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name));

                      const showCohortGrouping = cohortKeys.length > 1;
                      if (!showCohortGrouping) {
                        return (
                          <div
                            key={`${deptName}:${c.code}`}
                            className="grid gap-2"
                          >
                            {subjectsForCohort.map((s) => (
                              <SubjectCard
                                key={s.id}
                                id={s.id}
                                name={s.name}
                                className="w-full justify-start"
                                draggableId={`sidebar:subject:${s.id}`}
                                dragData={{
                                  type: "mini",
                                  kind: "subject",
                                  id: s.id,
                                }}
                              />
                            ))}
                          </div>
                        );
                      }

                      return (
                        <Collapsible
                          key={`${deptName}:${c.code}`}
                          defaultOpen={
                            deptName === "IT" && c.code !== "(No cohort)"
                          }
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
                                {deptName === "IT" &&
                                c.code !== "(No cohort)" ? (
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor:
                                        cohortColorHsl({
                                          code: c.code,
                                          sortOrder: c.sortOrder,
                                        }) ?? undefined,
                                    }}
                                    aria-hidden="true"
                                  />
                                ) : null}
                                <span>
                                  {c.code === "(No cohort)"
                                    ? c.code
                                    : formatCohortLabel({
                                        code: c.code,
                                        year: c.year,
                                      })}
                                </span>
                              </span>
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid gap-2">
                              {subjectsForCohort.map((s) => (
                                <SubjectCard
                                  key={s.id}
                                  id={s.id}
                                  name={s.name}
                                  className="w-full justify-start"
                                  draggableId={`sidebar:subject:${s.id}`}
                                  dragData={{
                                    type: "mini",
                                    kind: "subject",
                                    id: s.id,
                                  }}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}

                    {!deptSubjects.length ? (
                      <div className="text-xs text-muted-foreground">
                        No subjects
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {Array.from(subjectsByDepartment.keys())
              .filter(
                (name) =>
                  !FIXED_DEPARTMENT_ORDER.includes(name as any) &&
                  (subjectsByDepartment.get(name)?.length ?? 0) > 0,
              )
              .sort((a, b) => a.localeCompare(b))
              .map((deptName) => {
                const deptSubjects = (subjectsByDepartment.get(deptName) ?? [])
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name));

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
                        {deptSubjects.map((s) => (
                          <SubjectCard
                            key={s.id}
                            id={s.id}
                            name={s.name}
                            className="w-full justify-start"
                            draggableId={`sidebar:subject:${s.id}`}
                            dragData={{
                              type: "mini",
                              kind: "subject",
                              id: s.id,
                            }}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

            {!props.subjects.length ? (
              <div className="text-xs text-muted-foreground">No subjects</div>
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

        <SidebarSection title="Classrooms" hint="Drag rooms into lessons">
          <div className="space-y-2">
            {classroomsByFloor.orderedKeys.map((key) => {
              const rooms = classroomsByFloor.byKey.get(key) ?? [];
              if (!rooms.length) return null;
              return (
                <Collapsible
                  key={key}
                  defaultOpen={key.startsWith("1-") || key.startsWith("2-")}
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
                      <span>{key}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-2 pt-2">
                      {rooms.map((r) => (
                        <ClassroomCard
                          key={r.id}
                          id={r.id}
                          name={r.name}
                          className="w-full justify-start"
                          draggableId={`sidebar:room:${r.id}`}
                          dragData={{ type: "mini", kind: "room", id: r.id }}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {!props.classrooms.length ? (
              <div className="text-xs text-muted-foreground">No classrooms</div>
            ) : null}
          </div>
        </SidebarSection>
      </div>
    </div>
  );
}
