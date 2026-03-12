import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleImport } from "@/components/schedule/ScheduleImport";
import { ScheduleViewer } from "@/components/schedule/ScheduleViewer";
import { ScheduleBuilder } from "@/components/schedule/ScheduleBuilder";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SchedulePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title={dict.schedule.title} />
        <Link href="/dashboard/schedule/manage">
          <Button variant="outline">Manage Schedule</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.schedule.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleImport lang={lang} dict={dict} />
        </CardContent>
      </Card>

      <ScheduleViewer />
    </div>
  );
}
