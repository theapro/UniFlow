import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceSheetsView } from "@/components/sheets/AttendanceSheetsView";

export default async function AttendanceSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <AttendanceSheetsView lang={lang} dict={dict} />;
}
