import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary, type Locale } from "@/lib/i18n";
import { serverApiGet } from "@/lib/server-api";
import type {
  AttendanceGradesMeta,
  AttendanceTableData,
  SubjectMeta,
} from "@/types/attendance-grades.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { AttendanceMatrixEditor } from "@/components/attendance/AttendanceMatrixEditor";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function isISODate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function defaultDateRangeLast14DaysUTC() {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDt = new Date(today);
  fromDt.setUTCDate(fromDt.getUTCDate() - 13);
  const from = fromDt.toISOString().slice(0, 10);
  return { from, to };
}

function pickInitialSubjectId(
  subjects: SubjectMeta[],
  requested: string | undefined,
): string {
  const req = String(requested ?? "").trim();
  if (req && subjects.some((s) => s.id === req)) return req;
  return subjects[0]?.id ?? "";
}

export default async function AttendanceManagePage({
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
          title={dict?.nav?.attendance ?? "Attendance"}
          description="Manage attendance"
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/attendance`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
          }
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
          title={dict?.nav?.attendance ?? "Attendance"}
          description={group.name}
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/attendance`}>
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

  const { from: defaultFrom, to: defaultTo } = defaultDateRangeLast14DaysUTC();

  const requestedFrom = first(searchParams?.from);
  const requestedTo = first(searchParams?.to);
  const initialFrom = isISODate(requestedFrom) ? requestedFrom : defaultFrom;
  const initialTo = isISODate(requestedTo) ? requestedTo : defaultTo;

  const from = initialFrom <= initialTo ? initialFrom : defaultFrom;
  const to = initialFrom <= initialTo ? initialTo : defaultTo;

  const tableRes = await serverApiGet<AttendanceTableData>(
    "/api/admin/attendance/table",
    {
      cohortId: group.cohortId ?? undefined,
      groupId: group.id,
      subjectId: initialSubjectId,
      from,
      to,
    },
  );

  const subject = subjects.find((s) => s.id === initialSubjectId)!;

  const initialTable: AttendanceTableData = tableRes.ok
    ? tableRes.data
    : {
        cohortId: group.cohortId ?? null,
        group: { id: group.id, name: group.name },
        subject: { id: subject.id, name: subject.name },
        dates: [],
        rows: [],
      };

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict?.nav?.attendance ?? "Attendance"}
        description="Manage attendance for a group"
        actions={
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href={`/${lang}/dashboard/attendance`}>
              {dict?.common?.back ?? "Back"}
            </Link>
          </Button>
        }
      />

      {!tableRes.ok ? (
        <div className="text-sm text-destructive">
          {tableRes.status === 403
            ? "Forbidden: missing VIEW_ATTENDANCE permission"
            : tableRes.message}
        </div>
      ) : null}

      <AttendanceMatrixEditor
        lang={lang}
        dict={dict}
        group={group}
        cohort={cohort ? { id: cohort.id, code: cohort.code } : null}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
        initialSubjectId={initialSubjectId}
        initialFrom={from}
        initialTo={to}
        initialTable={initialTable}
      />
    </div>
  );
}
