import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AIMonitorPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <PageHeader title={dict.nav.aiMonitor} />

      <Card>
        <CardHeader>
          <CardTitle>AI Assistant Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI conversation monitoring and analytics will be displayed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
