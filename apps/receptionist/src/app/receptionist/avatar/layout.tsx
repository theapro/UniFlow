import { cookies } from "next/headers";

import { AvatarExperienceLazy } from "@/features/receptionist/avatar/AvatarExperienceLazy";
import { getReceptionistInitData } from "@/features/receptionist/server/get-init";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const DEFAULT_MODEL_URL = "/receptionist/assets/3dleia/leia.vrm";

export default async function ReceptionistAvatarLayout(props: {
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
    // If init fails, still render the avatar with the default local model.
  }

  return (
    <>
      <AvatarExperienceLazy
        assistantName={assistantName}
        conversationId={conversationId}
        modelUrl={DEFAULT_MODEL_URL}
      />
      {props.children}
    </>
  );
}
