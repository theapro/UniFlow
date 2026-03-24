import { getDictionary, type Locale } from "@/lib/i18n";
import { TeachersSheetsHeader } from "@/components/sheets/teachers/TeachersSheetsHeader";
import { TeachersSheetsTabs } from "@/components/sheets/teachers/TeachersSheetsTabs";

export default async function TeachersSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <TeachersSheetsHeader dict={dict} />
      <TeachersSheetsTabs dict={dict} />
    </div>
  );
}
