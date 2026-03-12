import { getDictionary, type Locale } from "@/lib/i18n";
import { ParentGroupsView } from "@/components/parent-groups/ParentGroupsView";

export default async function ParentGroupsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <ParentGroupsView lang={lang} dict={dict} />;
}
