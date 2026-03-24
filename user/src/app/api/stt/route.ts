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

    const form = await req.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "audio file is required" },
        { status: 400 },
      );
    }

    const modelRaw = form.get("model");
    const model =
      typeof modelRaw === "string" && modelRaw.trim().length > 0
        ? modelRaw.trim()
        : "whisper-large-v3-turbo";

    const groqForm = new FormData();
    groqForm.set("file", audio, audio.name || "audio.webm");
    groqForm.set("model", model);
    groqForm.set("response_format", "json");

    const res = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqForm,
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return NextResponse.json(
        { error: text || res.statusText },
        { status: res.status },
      );
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const transcript = String(json?.text ?? "").trim();
    if (!transcript) {
      return NextResponse.json(
        { error: "No speech detected" },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { text: transcript },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("STT API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
