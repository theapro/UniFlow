import { NextRequest, NextResponse } from "next/server";

import { BACKEND_URL } from "@/lib/backend";

export const dynamic = "force-dynamic";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function POST(req: NextRequest) {
  try {
    const cookieConversationId = req.cookies.get(
      "receptionistConversationId",
    )?.value;

    const form = await req.formData();

    const bodyConversationId = asString(form.get("conversationId"));
    const sessionId = asString(form.get("sessionId"));

    const conversationId =
      bodyConversationId || sessionId || cookieConversationId || "";
    if (conversationId) form.set("conversationId", conversationId);

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/receptionist/voice`,
      {
        method: "POST",
        cache: "no-store",
        body: form,
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

    const payload =
      data && typeof data === "object"
        ? {
            ...data,
            // compatibility with the existing voice hook
            text:
              asString((data as any).text) || asString((data as any).replyText),
          }
        : data;

    const res = NextResponse.json(payload, { status: 200 });

    const newConversationId =
      asString((data as any)?.conversationId) || conversationId;
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
    console.error("Receptionist voice proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
