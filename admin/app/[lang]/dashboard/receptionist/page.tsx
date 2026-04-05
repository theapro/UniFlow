import { getDictionary, type Locale } from "@/lib/i18n";
import { ReceptionistView } from "@/components/receptionist/ReceptionistView";

export default async function ReceptionistPage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return <ReceptionistView lang={lang} dict={dict} />;
}
