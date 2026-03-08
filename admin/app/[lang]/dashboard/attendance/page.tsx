import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceTabsView } from "@/components/attendance/AttendanceTabsView";

export default async function AttendancePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <AttendanceTabsView lang={lang} dict={dict} />;
}
