import { getDictionary, type Locale } from "@/lib/i18n";
import { SubjectsView } from "@/components/subjects/SubjectsView";

export default async function SubjectsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <SubjectsView lang={lang} dict={dict} />;
}
