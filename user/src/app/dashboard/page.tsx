import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UserMenu, type CurrentUser } from "@/components/user-menu";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export default function DashboardPage() {
  const token = cookies().get("token")?.value;
  if (!token) {
    redirect("/login?from=/dashboard&error=unauthorized");
  }

  // Note: we intentionally validate the token with backend before rendering.
  // This avoids showing dashboard to users with expired/invalid tokens.
  return <DashboardWithUser token={token} />;
}

async function DashboardWithUser({ token }: { token: string }) {
  let currentUser: CurrentUser | null = null;

  try {
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!meRes.ok) {
      redirect("/login?from=/dashboard&error=session_expired");
    }

    const meJson = (await meRes.json()) as any;
    const me = meJson?.data;
    if (!me?.email) {
      redirect("/login?from=/dashboard&error=session_expired");
    }

    currentUser = {
      email: me.email,
      fullName: me.fullName ?? null,
      role: me.role,
    };
  } catch {
    redirect("/login?from=/dashboard&error=session_expired");
  }

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <ChatSidebar variant="inset" />
      <SidebarInset className="overflow-hidden">
        <SiteHeader
          title="AI Chat"
          right={currentUser ? <UserMenu user={currentUser} /> : null}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <ChatLayout />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
