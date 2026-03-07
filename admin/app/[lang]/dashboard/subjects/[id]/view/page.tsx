import { getDictionary, type Locale } from "@/lib/i18n";
import { SubjectDetailView } from "@/components/subjects/SubjectDetailView";

export default async function SubjectViewPage({
  params: { lang, id },
}: {
  params: { lang: Locale; id: string };
}) {
  const dict = await getDictionary(lang);
  return <SubjectDetailView lang={lang} dict={dict} id={id} />;
}
