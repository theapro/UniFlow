import { getDictionary, type Locale } from "@/lib/i18n";
import { CohortDetailView } from "@/components/cohorts/CohortDetailView";

export default async function CohortDetailPage({
  params: { lang, id },
}: {
  params: { lang: Locale; id: string };
}) {
  const dict = await getDictionary(lang);
  return <CohortDetailView lang={lang} dict={dict} id={id} />;
}
