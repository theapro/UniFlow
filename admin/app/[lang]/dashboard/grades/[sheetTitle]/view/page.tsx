import { getDictionary, type Locale } from "@/lib/i18n";
import { GradesTabView } from "@/components/grades/GradesTabView";

export default async function GradesTabViewPage({
  params: { lang, sheetTitle },
}: {
  params: { lang: Locale; sheetTitle: string };
}) {
  const dict = await getDictionary(lang);
  return <GradesTabView lang={lang} dict={dict} sheetTitle={sheetTitle} />;
}
