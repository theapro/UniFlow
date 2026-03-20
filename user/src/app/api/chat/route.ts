import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : undefined;

    // New format: { sessionId?, message }
    let message = typeof body?.message === "string" ? body.message : "";

    // Backward compatibility: { messages: [...] }
    if (!message && Array.isArray(body?.messages)) {
      const last = body.messages[body.messages.length - 1];
      if (last?.role === "user" && typeof last?.content === "string") {
        message = last.content;
      }
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 },
      );
    }

    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/ai/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        message,
        model: typeof body?.model === "string" ? body.model : undefined,
        temperature:
          typeof body?.temperature === "number" ? body.temperature : undefined,
        contextLimit:
          typeof body?.contextLimit === "number"
            ? body.contextLimit
            : undefined,
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text().catch(() => "");
      return NextResponse.json(
        { error: errorText || backendResponse.statusText },
        { status: backendResponse.status },
      );
    }

    return new Response(backendResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
