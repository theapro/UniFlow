import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL?.replace(/\/$/, "") ||
  "https://api.groq.com/openai/v1";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  process.env.BACKEND_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

function normalizeText(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseInput(input: string): boolean {
  const s = normalizeText(input).toLowerCase();
  if (!s) return true;

  const shortAllowed = new Set([
    "ok",
    "okay",
    "hi",
    "hey",
    "yo",
    "yes",
    "no",
    "yeah",
    "yep",
    "sure",
    // Uzbek
    "ha",
    "yo'q",
    "yoq",
    // Japanese
    "はい",
    "いいえ",
    "うん",
  ]);
  if (s.length < 3 && !shortAllowed.has(s)) return true;
  const noise = new Set([".", "..", "...", "000", "00", "0", "uh", "um", "ah"]);
  if (noise.has(s)) return true;
  if (/^(\.|0)+$/.test(s)) return true;

  const noPunct = s
    .replace(/[.\-_,!?:;"'`~()\[\]{}<>\\/|@#$%^&*=+]/g, "")
    .trim();
  if (!noPunct) return true;

  return false;
}

function looksLikeBulletList(chatText: string): boolean {
  return /^\s*[-•*]\s+/m.test(String(chatText ?? ""));
}

function parseScheduleBullets(chatText: string): Array<{
  start?: string;
  end?: string;
  subject: string;
}> {
  const lines = String(chatText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));

  const out: Array<{ start?: string; end?: string; subject: string }> = [];

  for (const l of lines) {
    const raw = l.replace(/^[-•*]+\s+/, "").trim();
    // Typical: "11:50-13:05 Algorithms — Teacher (Room)"
    const m = raw.match(
      /^(?<start>\d{1,2}:\d{2})\s*[-–]\s*(?<end>\d{1,2}:\d{2})\s+(?<rest>.+)$/,
    );
    if (m?.groups?.rest) {
      const rest = String(m.groups.rest);
      const subject = rest
        .split(/[—–]/)[0]
        .replace(/\s*\([^)]*\)\s*$/g, "")
        .trim();
      out.push({ start: m.groups.start, end: m.groups.end, subject });
      continue;
    }

    // Fallback: no time range
    const subject = raw
      .split(/[—–]/)[0]
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim();
    if (subject) out.push({ subject });
  }

  return out;
}

function buildSpeechText(chatText: string): string {
  const raw = String(chatText ?? "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase();
  const isSchedule =
    lower.startsWith("today") ||
    lower.includes("schedule") ||
    lower.includes("jadval") ||
    raw.startsWith("今日") ||
    raw.startsWith("今週") ||
    raw.startsWith("今月");

  if (isSchedule && looksLikeBulletList(raw)) {
    const items = parseScheduleBullets(raw);
    if (items.length === 0) return raw;

    const intro = (() => {
      if (raw.startsWith("Bugungi")) return "Xo‘p. Bugun sizda:";
      if (raw.startsWith("Haftalik")) return "Xo‘p. Bu hafta sizda:";
      if (raw.startsWith("Oylik")) return "Xo‘p. Bu oy sizda:";
      if (raw.startsWith("今日")) return "わかりました。今日の予定は:";
      if (raw.startsWith("今週")) return "わかりました。今週の予定は:";
      if (raw.startsWith("今月")) return "わかりました。今月の予定は:";
      if (raw.toLowerCase().startsWith("today"))
        return "Alright. Today you have:";
      if (raw.toLowerCase().startsWith("weekly"))
        return "Alright. This week you have:";
      if (raw.toLowerCase().startsWith("monthly"))
        return "Alright. This month you have:";
      return "Alright. Here is your schedule:";
    })();

    const parts: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const time = it.start
        ? it.end
          ? `from ${it.start} to ${it.end}`
          : `at ${it.start}`
        : "";
      const core = time ? `${it.subject} ${time}` : `${it.subject}`;

      if (i === 0) parts.push(core);
      else if (i === items.length - 1) parts.push(`and later ${core}`);
      else parts.push(`then ${core}`);
    }

    return `${intro} ${parts.join(", ")}.`;
  }

  // Generic fallback: keep it conversational.
  return raw;
}

function preprocessTtsText(input: string): string {
  let s = String(input ?? "");

  // Abbreviation expansion / pronunciation fixes
  s = s.replace(/\be\.g\./gi, "for example");
  s = s.replace(/\bi\.e\./gi, "that is");
  s = s.replace(/\bA\.?I\.?\b/g, "A I");

  // Avoid symbol-heavy text in speech
  s = s.replace(/[•]/g, "");
  s = s.replace(/[—–]/g, ", ");

  // Remove common bullet prefixes if any remain
  s = s
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-•*]+\s+/, "").trim())
    .filter(Boolean)
    .join(". ");

  s = normalizeText(s);

  // Break long sentences into shorter ones (best-effort, TTS-friendly)
  const maxLen = 140;
  const pieces: string[] = [];
  const rough = s
    .replace(/\s*([;:])\s*/g, ". ")
    .replace(/\s*\n+\s*/g, ". ")
    .split(/(?<=[.!?])\s+/);

  for (const part of rough) {
    const p = part.trim();
    if (!p) continue;
    if (p.length <= maxLen) {
      pieces.push(p);
      continue;
    }

    // Split long parts on commas first
    const commaSplit = p.split(/\s*,\s*/);
    let current = "";
    for (const seg of commaSplit) {
      const next = current ? `${current}, ${seg}` : seg;
      if (next.length > maxLen && current) {
        pieces.push(current.endsWith(".") ? current : `${current}.`);
        current = seg;
      } else {
        current = next;
      }
    }
    if (current) pieces.push(current.endsWith(".") ? current : `${current}.`);
  }

  // Add slight pauses by ensuring punctuation spacing
  return normalizeText(pieces.join(" "));
}

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
      contextLimit: 12,
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

  const preferredVoice =
    process.env.GROQ_TTS_VOICE?.trim().toLowerCase() || "autumn";
  const voiceCandidates = Array.from(
    new Set([preferredVoice, "autumn", "diana", "hannah"].filter(Boolean)),
  );

  const attempt = async (model: string, voice: string) => {
    const res = await fetch(`${GROQ_BASE_URL}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: params.text,
        voice,
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

  const modelsToTry =
    preferredModel === "canopylabs/orpheus-v1-english"
      ? [preferredModel]
      : [preferredModel, "canopylabs/orpheus-v1-english"];

  let lastFailure: {
    res: Response;
    errText: string;
    model: string;
    voice: string;
  } | null = null;

  for (const model of modelsToTry) {
    for (const voice of voiceCandidates) {
      const result = await attempt(model, voice);
      if (result.ok) {
        return { audio: result.audio, contentType: result.contentType };
      }
      lastFailure = { res: result.res, errText: result.errText, model, voice };
    }
  }

  if (lastFailure) {
    throw new Error(
      `TTS_FAILED:${lastFailure.res.status}:${lastFailure.res.statusText}:${lastFailure.model}:${lastFailure.voice}:${lastFailure.errText}`,
    );
  }

  throw new Error("TTS_FAILED");
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
    if (!transcript || isNoiseInput(transcript)) {
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

    const chatText = assistantText;
    const speechText = preprocessTtsText(buildSpeechText(chatText));

    console.log("AI RESPONSE:", chatText);
    let ttsAudioBase64 = "";
    let ttsMime = "";
    let ttsError: string | null = null;

    try {
      const tts = await groqTts({ text: speechText, apiKey });
      ttsAudioBase64 = arrayBufferToBase64(tts.audio);
      ttsMime = tts.contentType;

      console.log("TTS GENERATED", {
        bytes: tts.audio.byteLength,
        mime: tts.contentType,
      });
    } catch (e) {
      ttsError = e instanceof Error ? e.message : "TTS_FAILED";
      console.error("TTS failed (text-only fallback)", ttsError);
    }

    return NextResponse.json(
      {
        transcript,
        text: chatText,
        speechText,
        audioBase64: ttsAudioBase64,
        mime: ttsMime || "audio/mpeg",
        audioMime: ttsMime || "audio/mpeg",
        ttsError,
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
