import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrentChatTitle } from "@/components/chat/CurrentChatTitle";
import { ExportChatButton } from "@/components/chat/ExportChatButton";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default function ChatPage() {
  return (
    <>
      <SiteHeader
        title={<CurrentChatTitle fallback="AI Chat" />}
        right={
          <>
            <ExportChatButton />
            <ThemeToggle />
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="@container/main flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <ChatLayout />
        </div>
      </div>
    </>
  );
}
