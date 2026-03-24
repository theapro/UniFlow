import { getDictionary, type Locale } from "@/lib/i18n";
import { AttendanceSheetsHeader } from "@/components/sheets/attendance/AttendanceSheetsHeader";
import { AttendanceSheetsTabs } from "@/components/sheets/attendance/AttendanceSheetsTabs";

export default async function AttendanceSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <AttendanceSheetsHeader dict={dict} />
      <AttendanceSheetsTabs dict={dict} />
    </div>
  );
}
