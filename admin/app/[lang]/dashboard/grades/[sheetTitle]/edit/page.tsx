import { getDictionary, type Locale } from "@/lib/i18n";
import { GradesTabEditView } from "@/components/grades/GradesTabEditView";

export default async function GradesTabEditPage({
  params: { lang, sheetTitle },
}: {
  params: { lang: Locale; sheetTitle: string };
}) {
  const dict = await getDictionary(lang);
  return <GradesTabEditView lang={lang} dict={dict} sheetTitle={sheetTitle} />;
}
