import { AppProviders } from "@/components/providers/app-providers";

export default function LangLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  void lang;

  return <AppProviders>{children}</AppProviders>;
}
