import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { serverApiGet } from "@/lib/server-api";
import type { AttendanceTableData } from "@/types/attendance-grades.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function shortStatus(v: unknown): string {
  const upper = String(v ?? "")
    .trim()
    .toUpperCase();
  if (!upper) return "";
  if (upper === "PRESENT" || upper === "P") return "P";
  if (upper === "ABSENT" || upper === "A") return "A";
  if (upper === "LATE" || upper === "L") return "L";
  if (upper === "EXCUSED" || upper === "E") return "E";
  return upper.slice(0, 1);
}

export default async function AttendanceViewPage({
  params: { lang },
  searchParams,
}: {
  params: { lang: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const dict = await getDictionary(lang);

  const groupId = first(searchParams?.groupId);
  const subjectId = first(searchParams?.subjectId);

  const { from: defaultFrom, to: defaultTo } = defaultDateRangeLast14DaysUTC();

  const requestedFrom = first(searchParams?.from);
  const requestedTo = first(searchParams?.to);
  const from = isISODate(requestedFrom) ? requestedFrom : defaultFrom;
  const to = isISODate(requestedTo) ? requestedTo : defaultTo;

  const title = dict?.nav?.attendance ?? "Attendance";

  if (!groupId || !subjectId) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="View attendance"
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/attendance`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
          }
        />
        <div className="text-sm text-muted-foreground">
          Missing required parameters. Open a group first, then click View.
        </div>
      </div>
    );
  }

  const tableRes = await serverApiGet<AttendanceTableData>(
    "/api/admin/attendance/table",
    {
      groupId,
      subjectId,
      from,
      to,
    },
  );

  if (!tableRes.ok) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="View attendance"
          actions={
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href={`/${lang}/dashboard/attendance`}>
                  {dict?.common?.back ?? "Back"}
                </Link>
              </Button>
              <Button asChild className="rounded-2xl">
                <Link
                  href={`/${lang}/dashboard/attendance/${encodeURIComponent(
                    groupId,
                  )}?subjectId=${encodeURIComponent(
                    subjectId,
                  )}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
                >
                  Manage
                </Link>
              </Button>
            </div>
          }
        />
        <div className="text-sm text-destructive">
          {tableRes.status === 403
            ? "Forbidden: missing VIEW_ATTENDANCE permission"
            : tableRes.message}
        </div>
      </div>
    );
  }

  const table = tableRes.data;

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={title}
        description={`${table.group.name} • ${table.subject.name} • ${from} → ${to}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/attendance`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
            <Button asChild className="rounded-2xl">
              <Link
                href={`/${lang}/dashboard/attendance/${encodeURIComponent(
                  groupId,
                )}?subjectId=${encodeURIComponent(
                  subjectId,
                )}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`}
              >
                Manage
              </Link>
            </Button>
          </div>
        }
      />

      <div className={cn("rounded-[28px] border border-border/40 bg-muted/10")}>
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background/80 backdrop-blur z-10">
              <tr className="border-b border-border/40">
                <th className="text-left font-medium p-3 w-[140px]">
                  Student #
                </th>
                <th className="text-left font-medium p-3 min-w-[240px]">
                  Full name
                </th>
                {table.dates.map((d) => (
                  <th
                    key={d}
                    className="text-left font-medium p-3 min-w-[120px]"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr
                  key={r.studentId}
                  className="border-b border-border/20 last:border-b-0"
                >
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {r.studentNumber}
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.fullName}</td>
                  {table.dates.map((d) => {
                    const v = shortStatus((r.cells as any)?.[d]);
                    return (
                      <td key={d} className="p-2">
                        <div className="h-9 w-12 rounded-md border border-border/40 bg-background/50 flex items-center justify-center text-xs font-semibold">
                          {v || ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {table.dates.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No scheduled lesson days in this date range.
        </div>
      ) : null}
    </div>
  );
}
