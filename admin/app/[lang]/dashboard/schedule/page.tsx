import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScheduleIndex } from "@/components/schedule/ScheduleIndex";

export default async function SchedulePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-4">
      <PageHeader title={dict.schedule.title} />
      <ScheduleIndex lang={lang} />
    </div>
  );
}
