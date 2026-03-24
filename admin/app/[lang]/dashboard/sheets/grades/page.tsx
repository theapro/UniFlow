import { getDictionary, type Locale } from "@/lib/i18n";
import { GradesSheetsHeader } from "@/components/sheets/grades/GradesSheetsHeader";
import { GradesSheetsTabs } from "@/components/sheets/grades/GradesSheetsTabs";

export default async function GradesSheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <div className="container max-w-7xl py-10 space-y-12">
      <GradesSheetsHeader dict={dict} />
      <GradesSheetsTabs dict={dict} />
    </div>
  );
}
