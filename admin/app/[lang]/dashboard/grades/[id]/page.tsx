import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, type Locale } from "@/lib/i18n";
import { serverApiGet } from "@/lib/server-api";
import type {
  AttendanceGradesMeta,
  GradesTableData,
  SubjectMeta,
} from "@/types/attendance-grades.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { GradesMatrixEditor } from "@/components/grades/GradesMatrixEditor";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function pickInitialSubjectId(
  subjects: SubjectMeta[],
  requested: string | undefined,
): string {
  const req = String(requested ?? "").trim();
  if (req && subjects.some((s) => s.id === req)) return req;
  return subjects[0]?.id ?? "";
}

export default async function GradesManagePage({
  params: { lang, id },
  searchParams,
}: {
  params: { lang: Locale; id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const dict = await getDictionary(lang);

  const metaRes = await serverApiGet<AttendanceGradesMeta>(
    "/api/admin/attendance-grades/meta",
  );
  if (!metaRes.ok) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={dict?.nav?.grades ?? "Grades"}
          description="Manage grades"
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/grades`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
          }
        />
        <div className="text-sm text-destructive">
          {metaRes.status === 403
            ? "Forbidden: missing VIEW_GRADES permission"
            : metaRes.message}
        </div>
      </div>
    );
  }

  const meta = metaRes.data;
  const group = (meta.groups ?? []).find((g) => g.id === id) ?? null;
  if (!group) notFound();

  const cohort = group.cohortId
    ? ((meta.cohorts ?? []).find((c) => c.id === group.cohortId) ?? null)
    : null;

  const subjectIdsForGroup = new Set(
    (meta.schedulePairs ?? [])
      .filter((p) => p.groupId === group.id)
      .map((p) => p.subjectId),
  );

  const subjects = (meta.subjects ?? [])
    .filter((s) => subjectIdsForGroup.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (subjects.length === 0) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={dict?.nav?.grades ?? "Grades"}
          description={group.name}
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/grades`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
          }
        />
        <div className="text-sm text-muted-foreground">
          No scheduled subjects found for this group. Add subjects in Schedule
          first.
        </div>
      </div>
    );
  }

  const requestedSubjectId = first(searchParams?.subjectId);
  const initialSubjectId = pickInitialSubjectId(subjects, requestedSubjectId);

  const tableRes = await serverApiGet<GradesTableData>(
    "/api/admin/grades/table",
    {
      cohortId: group.cohortId ?? undefined,
      groupId: group.id,
      subjectId: initialSubjectId,
    },
  );

  const subject = subjects.find((s) => s.id === initialSubjectId)!;

  const initialTable: GradesTableData = tableRes.ok
    ? tableRes.data
    : {
        cohortId: group.cohortId ?? null,
        group: { id: group.id, name: group.name },
        subject: { id: subject.id, name: subject.name },
        assignmentCount: 1,
        columns: ["1"],
        rows: [],
      };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.nav?.grades ?? "Grades"}
        description="Manage grades for a group"
        actions={
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href={`/${lang}/dashboard/grades`}>
              {dict?.common?.back ?? "Back"}
            </Link>
          </Button>
        }
      />

      {!tableRes.ok ? (
        <div className="text-sm text-destructive">
          {tableRes.status === 403
            ? "Forbidden: missing VIEW_GRADES permission"
            : tableRes.message}
        </div>
      ) : null}

      <GradesMatrixEditor
        lang={lang}
        dict={dict}
        group={group}
        cohort={cohort ? { id: cohort.id, code: cohort.code } : null}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialSubjectId={initialSubjectId}
        initialTable={initialTable}
      />
    </div>
  );
}
