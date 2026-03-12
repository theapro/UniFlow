import { getDictionary, type Locale } from "@/lib/i18n";
import { ClassroomsView } from "@/components/classrooms/ClassroomsView";

export default async function ClassroomsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <ClassroomsView lang={lang} dict={dict} />;
}
