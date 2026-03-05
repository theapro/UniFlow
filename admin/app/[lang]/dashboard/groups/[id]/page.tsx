import { getDictionary, type Locale } from "@/lib/i18n";
import { GroupDetailView } from "@/components/groups/GroupDetailView";

export default async function GroupDetailPage({
  params: { lang, id },
}: {
  params: { lang: Locale; id: string };
}) {
  const dict = await getDictionary(lang);
  return <GroupDetailView lang={lang} dict={dict} id={id} />;
}
