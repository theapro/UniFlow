import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { CurrentUser } from "@/components/user-menu";
import { ChatSidebar } from "@/components/chat/ChatSidebar";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("token")?.value;
  if (!token) {
    redirect("/login?from=/dashboard/chat&error=unauthorized");
  }

  const currentUser = await fetchCurrentUser(token);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <ChatSidebar variant="inset" user={currentUser} />
      <SidebarInset className="overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}

async function fetchCurrentUser(token: string): Promise<CurrentUser | null> {
  try {
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!meRes.ok) {
      redirect("/login?from=/dashboard/chat&error=session_expired");
    }

    const meJson = (await meRes.json()) as any;
    const me = meJson?.data;
    if (!me?.email) {
      redirect("/login?from=/dashboard/chat&error=session_expired");
    }

    return {
      email: me.email,
      fullName: me.fullName ?? null,
      role: me.role,
      permissions: Array.isArray(me.permissions) ? me.permissions : [],
    };
  } catch {
    redirect("/login?from=/dashboard/chat&error=session_expired");
  }
}
