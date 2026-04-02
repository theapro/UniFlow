import Link from "next/link";
import { ChevronRight, Layers } from "lucide-react";

import { getDictionary, type Locale } from "@/lib/i18n";
import { serverApiGet } from "@/lib/server-api";
import type {
  AttendanceGradesMeta,
  CohortMeta,
  GroupMeta,
  SubjectMeta,
} from "@/types/attendance-grades.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils";

type SubjectSection = {
  subject: SubjectMeta;
  groups: GroupMeta[];
};

type CohortSection = {
  key: string;
  label: string;
  cohort: CohortMeta | null;
  subjects: SubjectSection[];
};

function buildCohortSections(meta: AttendanceGradesMeta): CohortSection[] {
  const groupById = new Map((meta.groups ?? []).map((g) => [g.id, g] as const));
  const subjectById = new Map(
    (meta.subjects ?? []).map((s) => [s.id, s] as const),
  );

  const cohortSubjectGroups = new Map<string, Map<string, Set<string>>>();

  for (const pair of meta.schedulePairs ?? []) {
    const group = groupById.get(pair.groupId);
    const subject = subjectById.get(pair.subjectId);
    if (!group || !subject) continue;

    const cohortKey = group.cohortId ?? "__NO_COHORT__";
    const bySubject =
      cohortSubjectGroups.get(cohortKey) ?? new Map<string, Set<string>>();
    const groupIds = bySubject.get(subject.id) ?? new Set<string>();
    groupIds.add(group.id);
    bySubject.set(subject.id, groupIds);
    cohortSubjectGroups.set(cohortKey, bySubject);
  }

  const buildSection = (args: {
    key: string;
    label: string;
    cohort: CohortMeta | null;
  }): CohortSection => {
    const bySubject =
      cohortSubjectGroups.get(args.key) ?? new Map<string, Set<string>>();

    const subjects = Array.from(bySubject.entries())
      .map(([subjectId, groupIds]) => {
        const subject = subjectById.get(subjectId);
        if (!subject) return null;

        const groups = Array.from(groupIds)
          .map((id) => groupById.get(id) ?? null)
          .filter(Boolean) as GroupMeta[];

        groups.sort((a, b) => a.name.localeCompare(b.name));

        return { subject, groups } satisfies SubjectSection;
      })
      .filter(Boolean) as SubjectSection[];

    subjects.sort((a, b) => a.subject.name.localeCompare(b.subject.name));

    return {
      key: args.key,
      label: args.label,
      cohort: args.cohort,
      subjects,
    };
  };

  const cohortSections: CohortSection[] = (meta.cohorts ?? []).map((c) =>
    buildSection({ key: c.id, label: c.code, cohort: c }),
  );

  const noCohort = buildSection({
    key: "__NO_COHORT__",
    label: "(No cohort)",
    cohort: null,
  });

  const filtered = cohortSections.filter((s) => s.subjects.length > 0);
  if (noCohort.subjects.length) filtered.push(noCohort);

  return filtered;
}

export default async function AttendancePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  const metaRes = await serverApiGet<AttendanceGradesMeta>(
    "/api/admin/attendance-grades/meta",
  );

  const title = dict?.nav?.attendance ?? "Attendance";

  if (!metaRes.ok) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="Browse groups and open one to manage attendance"
        />
        <div className="text-sm text-destructive">
          {metaRes.status === 403
            ? "Forbidden: missing VIEW_ATTENDANCE permission"
            : metaRes.message}
        </div>
      </div>
    );
  }

  const meta = metaRes.data;
  const sections = buildCohortSections(meta);

  if (sections.length === 0) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="Pick a subject, then open a group to manage attendance"
        />
        <div className="text-sm text-muted-foreground">
          No scheduled subjects found. Add subjects to groups in Schedule first.
        </div>
      </div>
    );
  }

  const firstOpenKey = sections[0]?.key ?? null;

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={title}
        description="Pick a subject, then open a group to manage attendance"
      />

      <div className="space-y-5">
        {sections.map((section) => (
          <details
            key={section.key}
            open={section.key === firstOpenKey}
            className={cn(
              "rounded-[32px] px-6 transition-all",
              "bg-muted/10 border border-border/40",
            )}
          >
            <summary className="cursor-pointer select-none py-7 group flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-5 text-left">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/50 border border-border/40 text-muted-foreground">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-bold tracking-tight text-foreground/90">
                    {section.label}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    {section.subjects.length} Subjects
                  </span>
                </div>
              </div>

              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </summary>

            <div className="pb-8">
              {section.subjects.length ? (
                <div className="space-y-8">
                  {section.subjects.map((s) => (
                    <div key={s.subject.id} className="space-y-3">
                      <div className="flex items-end justify-between gap-4">
                        <div className="text-sm font-semibold tracking-tight text-foreground/90">
                          {s.subject.name}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                          {s.groups.length} Groups
                        </div>
                      </div>

                      {s.groups.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {s.groups.map((g) => (
                            <Link
                              key={g.id}
                              href={`/${lang}/dashboard/attendance/${g.id}?subjectId=${encodeURIComponent(
                                s.subject.id,
                              )}`}
                              className={cn(
                                "group relative flex items-center justify-between overflow-hidden rounded-2xl",
                                "border border-border/40 bg-background/50 p-5 transition-all duration-300",
                                "hover:border-primary/30 hover:bg-muted/30 hover:shadow-2xl hover:shadow-primary/5",
                                "active:scale-[0.98]",
                              )}
                            >
                              <div className="relative z-10 space-y-1 min-w-0">
                                <div className="text-[15px] font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors truncate">
                                  {g.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Open attendance matrix
                                </div>
                              </div>
                              <div className="rounded-full bg-primary/10 p-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                                <ChevronRight className="h-4 w-4 text-primary" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No groups scheduled for this subject.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No scheduled subjects found.
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
