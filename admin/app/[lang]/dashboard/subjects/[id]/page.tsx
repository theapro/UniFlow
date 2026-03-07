import { redirect } from "next/navigation";

export default function SubjectIdIndex({
  params: { lang, id },
}: {
  params: { lang: string; id: string };
}) {
  redirect(`/${lang}/dashboard/subjects/${id}/view`);
}
