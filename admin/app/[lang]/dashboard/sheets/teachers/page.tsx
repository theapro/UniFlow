import { getDictionary, type Locale } from "@/lib/i18n";
import { TeachersSheetsView } from "@/components/sheets/TeachersSheetsView";

export default async function TeachersSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <TeachersSheetsView lang={lang} dict={dict} />;
}
