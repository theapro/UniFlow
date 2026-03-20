import Link from "next/link";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/PageHeader";
import { ScheduleIndex } from "@/components/schedule/ScheduleIndex";
import { Button } from "@/components/ui/button";

export default async function SchedulePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <PageHeader
        title={dict.schedule.title}
        description={dict.schedule.description}
        actions={
          <Button asChild className="rounded-2xl">
            <Link href={`/${lang}/dashboard/schedule/create`}>
              {dict.schedule.createNew}
            </Link>
          </Button>
        }
      />
      <div className="rounded-[32px] border border-border/40 bg-muted/10 p-6">
        <ScheduleIndex lang={lang} />
      </div>
    </div>
  );
}
