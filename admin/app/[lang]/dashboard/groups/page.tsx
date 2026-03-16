import { getDictionary, type Locale } from "@/lib/i18n";
import { GroupsTreeView } from "@/components/groups/GroupsTreeView";

export default async function GroupsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <GroupsTreeView lang={lang} dict={dict} />;
}
