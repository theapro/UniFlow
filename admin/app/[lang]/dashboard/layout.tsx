import { getDictionary, type Locale } from "@/lib/i18n";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: Locale };
}) {
  const dict = await getDictionary(lang);

  return (
    <ProtectedRoute lang={lang}>
      <DashboardShell lang={lang} dict={dict}>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
