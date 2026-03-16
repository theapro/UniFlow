import { getDictionary, type Locale } from "@/lib/i18n";
import { CohortsView } from "@/components/cohorts/CohortsView";

export default async function CohortsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);
  return <CohortsView lang={lang} dict={dict} />;
}
