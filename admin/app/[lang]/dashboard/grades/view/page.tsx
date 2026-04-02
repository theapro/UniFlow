import Link from "next/link";

import { getDictionary, type Locale } from "@/lib/i18n";
import { serverApiGet } from "@/lib/server-api";
import type { GradesTableData } from "@/types/attendance-grades.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function GradesViewPage({
  params: { lang },
  searchParams,
}: {
  params: { lang: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const dict = await getDictionary(lang);

  const groupId = first(searchParams?.groupId);
  const subjectId = first(searchParams?.subjectId);

  const title = dict?.nav?.grades ?? "Grades";

  if (!groupId || !subjectId) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="View grades"
          actions={
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/grades`}>
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

  const tableRes = await serverApiGet<GradesTableData>(
    "/api/admin/grades/table",
    {
      groupId,
      subjectId,
    },
  );

  if (!tableRes.ok) {
    return (
      <div className="container max-w-7xl py-10 space-y-12">
        <PageHeader
          title={title}
          description="View grades"
          actions={
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-2xl">
                <Link href={`/${lang}/dashboard/grades`}>
                  {dict?.common?.back ?? "Back"}
                </Link>
              </Button>
              <Button asChild className="rounded-2xl">
                <Link
                  href={`/${lang}/dashboard/grades/${encodeURIComponent(
                    groupId,
                  )}?subjectId=${encodeURIComponent(subjectId)}`}
                >
                  Manage
                </Link>
              </Button>
            </div>
          }
        />
        <div className="text-sm text-destructive">
          {tableRes.status === 403
            ? "Forbidden: missing VIEW_GRADES permission"
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
        description={`${table.group.name} • ${table.subject.name}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/${lang}/dashboard/grades`}>
                {dict?.common?.back ?? "Back"}
              </Link>
            </Button>
            <Button asChild className="rounded-2xl">
              <Link
                href={`/${lang}/dashboard/grades/${encodeURIComponent(
                  groupId,
                )}?subjectId=${encodeURIComponent(subjectId)}`}
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
                {table.columns.map((c) => (
                  <th
                    key={c}
                    className="text-left font-medium p-3 min-w-[90px]"
                  >
                    {c}
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
                  {table.columns.map((c) => (
                    <td key={c} className="p-2">
                      <div className="h-9 w-12 rounded-md border border-border/40 bg-background/50 flex items-center justify-center text-xs font-semibold">
                        {r.cells[c] ?? ""}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
