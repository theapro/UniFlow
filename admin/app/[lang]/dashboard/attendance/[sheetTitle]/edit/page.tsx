import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceTabEditView } from "@/components/attendance/AttendanceTabEditView";

export default async function AttendanceTabEditPage({
  params: { lang, sheetTitle },
}: {
  params: { lang: Locale; sheetTitle: string };
}) {
  const dict = await getDictionary(lang);
  return (
    <AttendanceTabEditView lang={lang} dict={dict} sheetTitle={sheetTitle} />
  );
}
