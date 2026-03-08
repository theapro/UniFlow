import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceTabCreateView } from "@/components/attendance/AttendanceTabCreateView";

export default async function AttendanceCreatePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);
  return <AttendanceTabCreateView lang={lang} dict={dict} />;
}
