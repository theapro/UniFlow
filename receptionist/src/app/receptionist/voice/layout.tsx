import { cookies } from "next/headers";

import { getReceptionistInitData } from "@/features/receptionist/server/get-init";
import { VoiceExperienceClient } from "@/features/receptionist/voice/VoiceExperienceClient";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export default async function ReceptionistVoiceLayout(props: {
  children: React.ReactNode;
}) {
  const cookieConversationId =
    cookies().get("receptionistConversationId")?.value ?? null;

  let conversationId: string | null = cookieConversationId;
  let assistantName: string | undefined;

  try {
    const initial = await getReceptionistInitData({
      conversationId: cookieConversationId,
      limit: 0,
    });

    const initConversationId = asString(initial?.conversationId).trim();
    if (initConversationId) conversationId = initConversationId;

    assistantName = asString(initial?.avatar?.name).trim() || undefined;
  } catch {
    // Voice can still work without init; backend will create a conversation if needed.
  }

  return (
    <>
      <VoiceExperienceClient
        conversationId={conversationId}
        assistantName={assistantName}
      />
      {props.children}
    </>
  );
}
