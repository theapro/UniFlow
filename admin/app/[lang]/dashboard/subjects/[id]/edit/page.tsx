import { getDictionary, type Locale } from "@/lib/i18n";
import { SubjectEditView } from "@/components/subjects/SubjectEditView";

export default async function SubjectEditPage({
  params: { lang, id },
}: {
  params: { lang: Locale; id: string };
}) {
  const dict = await getDictionary(lang);
  return <SubjectEditView lang={lang} dict={dict} id={id} />;
}
