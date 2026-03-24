import { NextRequest } from "next/server";
import { BACKEND_URL, proxyJson } from "@/app/api/_lib/backend";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = encodeURIComponent(params.sessionId);
  const limit = req.nextUrl.searchParams.get("limit") ?? "200";
  return proxyJson(
    req,
    `${BACKEND_URL}/api/ai/chat/sessions/${sessionId}/messages?limit=${encodeURIComponent(limit)}`,
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = encodeURIComponent(params.sessionId);
  const body = await req.json().catch(() => ({}));

  // This endpoint is implemented in backend as part of this rebuild.
  return proxyJson(
    req,
    `${BACKEND_URL}/api/ai/chat/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
