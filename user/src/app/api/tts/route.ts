import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL?.replace(/\/$/, "") ||
  "https://api.groq.com/openai/v1";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured" },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    const input = typeof body?.text === "string" ? body.text.trim() : "";

    if (!input) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const model =
      typeof body?.model === "string" && body.model.trim().length > 0
        ? body.model.trim()
        : "canopylabs/orpheus-v1-english";

    const format =
      typeof body?.format === "string" && body.format.trim().length > 0
        ? body.format.trim()
        : "mp3";

    // Groq exposes an OpenAI-compatible TTS endpoint in many setups.
    // We keep this minimal and model-driven.
    const res = await fetch(`${GROQ_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        format,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: errText || res.statusText },
        { status: res.status },
      );
    }

    const audio = await res.arrayBuffer();
    const contentType =
      res.headers.get("content-type") ||
      (format === "wav" ? "audio/wav" : "audio/mpeg");

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
