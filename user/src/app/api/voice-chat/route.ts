import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL?.replace(/\/$/, "") ||
  "https://api.groq.com/openai/v1";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

async function readTextSafe(res: Response): Promise<string> {
  return await res.text().catch(() => "");
}

async function groqStt(params: { audio: File; model: string; apiKey: string }) {
  const groqForm = new FormData();
  groqForm.set("file", params.audio, params.audio.name || "audio.webm");
  groqForm.set("model", params.model);
  groqForm.set("response_format", "json");

  const res = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: groqForm,
  });

  const text = await readTextSafe(res);
  if (!res.ok) {
    throw new Error(`STT_FAILED:${res.status}:${res.statusText}:${text}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return String(json?.text ?? "").trim();
}

async function collectAssistantTextFromSse(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("NO_SSE_BODY");

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === "data: [DONE]") return accumulated;

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        try {
          const data = JSON.parse(jsonStr);
          if (typeof data === "string") accumulated += data;
          else if (typeof data?.content === "string")
            accumulated += data.content;
          else if (typeof data?.delta?.content === "string")
            accumulated += data.delta.content;
          else if (typeof data?.text === "string") accumulated += data.text;
        } catch {
          // Fallback: if backend sometimes sends raw text payloads
          accumulated += jsonStr;
        }
      }
    }
  }

  return accumulated;
}

async function backendAiChatToText(params: {
  token: string;
  sessionId?: string;
  message: string;
  model?: string;
}) {
  const backendResponse = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId: params.sessionId,
      message: params.message,
      model: params.model,
      temperature: 0.7,
    }),
  });

  if (!backendResponse.ok) {
    const errorText = await readTextSafe(backendResponse);
    throw new Error(
      `AI_CHAT_FAILED:${backendResponse.status}:${backendResponse.statusText}:${errorText}`,
    );
  }

  const assistantText = await collectAssistantTextFromSse(backendResponse);
  return assistantText.trim();
}

async function groqTts(params: { text: string; apiKey: string }) {
  const preferredModel =
    process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";

  const attempt = async (model: string) => {
    const res = await fetch(`${GROQ_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: params.text,
        voice: "austin",
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const errText = await readTextSafe(res);
      return { ok: false as const, res, errText };
    }

    const audio = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    return { ok: true as const, audio, contentType };
  };

  const first = await attempt(preferredModel);
  if (first.ok) return { audio: first.audio, contentType: first.contentType };

  // Fallback for older/alternate Groq model naming.
  if (preferredModel !== "canopylabs/orpheus-v1-english") {
    const second = await attempt("canopylabs/orpheus-v1-english");
    if (second.ok)
      return { audio: second.audio, contentType: second.contentType };
    throw new Error(
      `TTS_FAILED:${second.res.status}:${second.res.statusText}:${second.errText}`,
    );
  }

  throw new Error(
    `TTS_FAILED:${first.res.status}:${first.res.statusText}:${first.errText}`,
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Node runtime: Buffer is available
  return Buffer.from(buf).toString("base64");
}

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

    const sessionIdRaw = form.get("sessionId");
    const sessionId =
      typeof sessionIdRaw === "string" ? sessionIdRaw : undefined;

    const sttModelRaw = form.get("sttModel");
    const sttModel =
      typeof sttModelRaw === "string" && sttModelRaw.trim().length > 0
        ? sttModelRaw.trim()
        : "whisper-large-v3-turbo";

    const chatModelRaw = form.get("chatModel");
    const chatModel =
      typeof chatModelRaw === "string" && chatModelRaw.trim().length > 0
        ? chatModelRaw.trim()
        : undefined;

    const transcript = await groqStt({ audio, model: sttModel, apiKey });
    if (!transcript) {
      return NextResponse.json(
        { error: "No speech detected" },
        { status: 422 },
      );
    }

    console.log("STT RESULT:", transcript);

    const assistantText = await backendAiChatToText({
      token,
      sessionId,
      message: transcript,
      model: chatModel,
    });

    if (!assistantText) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 502 },
      );
    }

    console.log("AI RESPONSE:", assistantText);

    const tts = await groqTts({ text: assistantText, apiKey });

    console.log("TTS GENERATED", {
      bytes: tts.audio.byteLength,
      mime: tts.contentType,
    });

    return NextResponse.json(
      {
        transcript,
        text: assistantText,
        audioBase64: arrayBufferToBase64(tts.audio),
        mime: tts.contentType,
        audioMime: tts.contentType,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const msg =
      error instanceof Error && error.message
        ? error.message
        : "Internal server error";

    console.error("Voice chat API error:", {
      message: msg,
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
