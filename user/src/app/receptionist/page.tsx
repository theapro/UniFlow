import { cookies } from "next/headers";

import { ReceptionistClient } from "./receptionist-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

async function getInitData(conversationId: string | null) {
  const url = new URL(`${BACKEND_URL}/api/receptionist/init`);
  if (conversationId) url.searchParams.set("conversationId", conversationId);

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as any;

  if (!res.ok) {
    const msg =
      String(json?.message ?? json?.error ?? "").trim() || res.statusText;
    throw new Error(msg);
  }

  return (json?.data ?? json) as any;
}

export default async function ReceptionistPage() {
  const conversationId =
    cookies().get("receptionistConversationId")?.value ?? null;

  let initialData: any = null;
  let error: string | null = null;

  try {
    initialData = await getInitData(conversationId);
  } catch (e: any) {
    error = String(e?.message ?? "Failed to initialize receptionist");
  }

  return (
    <ReceptionistClient
      backendUrl={BACKEND_URL}
      cookieConversationId={conversationId}
      initialData={initialData}
      initialError={error}
    />
  );
}
