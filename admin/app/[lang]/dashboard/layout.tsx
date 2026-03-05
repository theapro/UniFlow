import { getDictionary, type Locale } from "@/lib/i18n";
import { UniFlowSidebar } from "@/components/uniflow-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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
      <SidebarProvider>
        <UniFlowSidebar variant="inset" lang={lang} dict={dict} />
        <SidebarInset>
          <SiteHeader title={dict.nav.dashboard} />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
                {children}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
