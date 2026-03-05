import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleImport } from "@/components/schedule/ScheduleImport";
import { ScheduleViewer } from "@/components/schedule/ScheduleViewer";

export default async function SchedulePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <PageHeader title={dict.schedule.title} />

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
