import { getDictionary, type Locale } from "@/lib/i18n";
import { SheetsView } from "@/components/sheets/SheetsView";

export default async function SheetsPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <SheetsView lang={lang} dict={dict} />;
}
