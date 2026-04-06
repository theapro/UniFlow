import { cookies } from "next/headers";

import { ReceptionistChatOverlayClient } from "@/features/receptionist/components/ReceptionistChatOverlayClient";
import { getReceptionistInitData } from "@/features/receptionist/server/get-init";

export const dynamic = "force-dynamic";

export default async function ReceptionistAvatarChatPage() {
  const conversationId =
    cookies().get("receptionistConversationId")?.value ?? null;

  let initialData = null;
  let error: string | null = null;

  try {
    initialData = await getReceptionistInitData({
      conversationId,
      limit: 200,
    });
  } catch (e: any) {
    error = String(e?.message ?? "Failed to initialize receptionist chat");
  }

  return (
    <ReceptionistChatOverlayClient
      closeHref="/receptionist/avatar"
      initialData={initialData}
      initialError={error}
    />
  );
}
