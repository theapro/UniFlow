import { getDictionary, type Locale } from "@/lib/i18n";
import { UniversityDataView } from "@/components/university-data/UniversityDataView";

export default async function UniversityDataPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);
  return <UniversityDataView lang={lang} dict={dict} />;
}
