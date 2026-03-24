import { getDictionary, type Locale } from "@/lib/i18n";
import { StudentsSheetsHeader } from "@/components/sheets/students/StudentsSheetsHeader";
import { StudentsSheetsTabs } from "@/components/sheets/students/StudentsSheetsTabs";

export default async function SheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <StudentsSheetsHeader dict={dict} />
      <StudentsSheetsTabs dict={dict} />
    </div>
  );
}
