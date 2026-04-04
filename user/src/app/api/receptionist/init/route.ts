import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/app/api/_lib/backend";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(req: NextRequest) {
  try {
    const cookieConversationId = req.cookies.get(
      "receptionistConversationId",
    )?.value;

    const conversationId =
      req.nextUrl.searchParams.get("conversationId") ||
      cookieConversationId ||
      "";

    const language = req.nextUrl.searchParams.get("language") || "";
    const limit = req.nextUrl.searchParams.get("limit") || "";

    const url = new URL(`${BACKEND_URL}/api/receptionist/init`);
    if (conversationId) url.searchParams.set("conversationId", conversationId);
    if (language) url.searchParams.set("language", language);
    if (limit) url.searchParams.set("limit", limit);

    const backendResponse = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const text = await backendResponse.text().catch(() => "");
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          error:
            asString(json?.message) ||
            asString(json?.error) ||
            text ||
            backendResponse.statusText,
        },
        { status: backendResponse.status },
      );
    }

    const data = json?.data ?? json;

    const res = NextResponse.json(data, { status: 200 });
    const newConversationId = asString(data?.conversationId);
    if (newConversationId) {
      res.cookies.set({
        name: "receptionistConversationId",
        value: newConversationId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return res;
  } catch (error) {
    console.error("Receptionist init proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
