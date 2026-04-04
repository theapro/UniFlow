import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/app/api/_lib/backend";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest) {
  try {
    const cookieConversationId = req.cookies.get(
      "receptionistConversationId",
    )?.value;

    const body = (await req.json().catch(() => null)) as any;
    const message = asString(body?.message).trim();
    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const conversationId =
      asString(body?.conversationId).trim() || cookieConversationId || "";
    const language = body?.language ?? undefined;
    const modality = body?.modality ?? undefined;

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/receptionist/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          message,
          conversationId,
          ...(language !== undefined ? { language } : {}),
          ...(modality !== undefined ? { modality } : {}),
        }),
      },
    );

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
    console.error("Receptionist chat proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
