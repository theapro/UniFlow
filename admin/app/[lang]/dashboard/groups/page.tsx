import { getDictionary, type Locale } from "@/lib/i18n";
import { GroupsView } from "@/components/groups/GroupsView";

export default async function GroupsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <GroupsView lang={lang} dict={dict} />;
}
