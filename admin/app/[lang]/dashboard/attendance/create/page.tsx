import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export default async function AttendanceCreatePage({
  params: { lang },
}: {
  params: { lang: Locale };
}) {
  redirect(`/${lang}/dashboard/attendance`);
}
