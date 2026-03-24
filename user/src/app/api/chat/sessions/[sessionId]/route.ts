import { NextRequest } from "next/server";
import { BACKEND_URL, proxyJson } from "@/app/api/_lib/backend";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const body = await req.json().catch(() => ({}));
  const sessionId = encodeURIComponent(params.sessionId);
  return proxyJson(req, `${BACKEND_URL}/api/ai/chat/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const sessionId = encodeURIComponent(params.sessionId);
  return proxyJson(req, `${BACKEND_URL}/api/ai/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
}
