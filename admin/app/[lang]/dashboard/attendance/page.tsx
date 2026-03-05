import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AttendancePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <PageHeader title={dict.attendance.title} />

      <Card>
        <CardHeader>
          <CardTitle>{dict.attendance.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Attendance tracking interface will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
