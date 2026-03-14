import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import data from "../../dashboard/data.json";

export default async function DashboardPage({
  params: { lang },
}: {
  params: { lang: string };
}) {
  const base = `/${lang}/dashboard`;

  return (
    <div className="-mx-4 space-y-6 lg:-mx-6">
      <SectionCards />

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/students`}>Students</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/teachers`}>Teachers</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/groups`}>Groups</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/schedule`}>Schedule</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/attendance`}>Attendance</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href={`${base}/grades`}>Grades</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </div>
  );
}
