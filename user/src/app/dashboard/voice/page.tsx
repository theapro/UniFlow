import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { VoiceChatPage } from "@/components/voice/VoiceChatPage";

export default function VoicePage() {
  return (
    <>
      <SiteHeader title="Voice" right={<ThemeToggle />} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="@container/main flex min-h-0 flex-1 flex-col overflow-hidden">
          <VoiceChatPage />
        </div>
      </div>
    </>
  );
}
