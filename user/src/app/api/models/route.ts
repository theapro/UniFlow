import { NextRequest } from "next/server";
import { BACKEND_URL, proxyJson } from "@/app/api/_lib/backend";

export async function GET(req: NextRequest) {
  return proxyJson(req, `${BACKEND_URL}/api/ai/models`);
}
