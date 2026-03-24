import { NextRequest } from "next/server";
import { BACKEND_URL, proxyJson } from "@/app/api/_lib/backend";

export async function GET(req: NextRequest) {
  return proxyJson(req, `${BACKEND_URL}/api/ai/chat/sessions`);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyJson(req, `${BACKEND_URL}/api/ai/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
