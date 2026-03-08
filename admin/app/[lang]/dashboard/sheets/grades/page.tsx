import { getDictionary, type Locale } from "@/lib/i18n";
import { GradesSheetsView } from "@/components/sheets/GradesSheetsView";

export default async function GradesSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <GradesSheetsView lang={lang} dict={dict} />;
}
