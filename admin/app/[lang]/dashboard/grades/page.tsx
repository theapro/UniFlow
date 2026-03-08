import { getDictionary, type Locale } from "@/lib/i18n";
import { GradesTabsView } from "@/components/grades/GradesTabsView";

export default async function GradesPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);
  return <GradesTabsView lang={lang} dict={dict} />;
}
