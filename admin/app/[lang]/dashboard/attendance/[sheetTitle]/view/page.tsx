import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceTabView } from "@/components/attendance/AttendanceTabView";

export default async function AttendanceTabViewPage({
  params: { lang, sheetTitle },
}: {
  params: { lang: Locale; sheetTitle: string };
}) {
  const dict = await getDictionary(lang);
  return <AttendanceTabView lang={lang} dict={dict} sheetTitle={sheetTitle} />;
}
