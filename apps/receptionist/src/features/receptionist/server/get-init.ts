import { BACKEND_URL } from "@/lib/backend";
import type { ReceptionistInitData } from "../types";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function getReceptionistInitData(params: {
  conversationId?: string | null;
  language?: string | null;
  limit?: number;
}): Promise<ReceptionistInitData> {
  const url = new URL(`${BACKEND_URL}/api/receptionist/init`);

  if (params.conversationId) {
    url.searchParams.set("conversationId", params.conversationId);
  }

  if (params.language) {
    url.searchParams.set("language", params.language);
  }

  if (typeof params.limit === "number") {
    url.searchParams.set("limit", String(params.limit));
  }

  const res = await fetch(url, { cache: "no-store" });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg =
      asString(json?.message) ||
      asString(json?.error) ||
      text ||
      res.statusText;
    throw new Error(msg);
  }

  return (json?.data ?? json) as ReceptionistInitData;
}
