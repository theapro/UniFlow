import { redirect } from "next/navigation";

export default function DangerZoneRedirect({
  params: { lang },
}: {
  params: { lang: string };
}) {
  redirect(`/${lang}/dashboard/settings/danger-zone`);
}
