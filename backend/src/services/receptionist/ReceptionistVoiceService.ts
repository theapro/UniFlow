import { env } from "../../config/env";

function pickFirstNonEmpty(
  ...values: Array<string | undefined | null>
): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64");
}

async function readTextSafe(res: Response): Promise<string> {
  return await res.text().catch(() => "");
}

export class ReceptionistVoiceService {
  private readonly groqBaseUrl = pickFirstNonEmpty(
    process.env.GROQ_BASE_URL,
    "https://api.groq.com/openai/v1",
  );

  private requireGroqKey(): string {
    const key = pickFirstNonEmpty(process.env.GROQ_API_KEY, env.groqApiKey);
    if (!key) throw new Error("GROQ_API_KEY is not configured");
    return key;
  }

  async stt(params: {
    audioBytes: Buffer;
    filename: string;
    mimeType: string;
    model?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ text: string }> {
    const apiKey = this.requireGroqKey();

    const form = new FormData();
    // DOM typings for BlobPart don't accept Node Buffer (it can be backed by SharedArrayBuffer).
    // Copy into a plain ArrayBuffer for type-safety and broad compatibility.
    const arrayBuffer = new ArrayBuffer(params.audioBytes.byteLength);
    new Uint8Array(arrayBuffer).set(params.audioBytes);
    const blob = new Blob([arrayBuffer], { type: params.mimeType });

    form.set("file", blob, params.filename || "audio.webm");
    form.set("model", params.model ?? "whisper-large-v3-turbo");
    form.set("response_format", "json");

    const res = await fetch(`${this.groqBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: params.abortSignal,
    });

    const text = await readTextSafe(res);
    if (!res.ok) {
      throw new Error(
        `STT_FAILED:${res.status}:${res.statusText}:${text}`.slice(0, 4000),
      );
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { text: String(json?.text ?? "").trim() };
  }

  async tts(params: {
    text: string;
    model?: string;
    format?: "mp3" | "wav";
    abortSignal?: AbortSignal;
  }): Promise<{ audioBase64: string; mime: string }> {
    const apiKey = this.requireGroqKey();

    const model = params.model ?? "canopylabs/orpheus-v1-english";
    const format = params.format ?? "mp3";

    const res = await fetch(`${this.groqBaseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: params.text,
        format,
      }),
      signal: params.abortSignal,
    });

    if (!res.ok) {
      const errText = await readTextSafe(res);
      throw new Error(
        `TTS_FAILED:${res.status}:${res.statusText}:${errText}`.slice(0, 4000),
      );
    }

    const audio = await res.arrayBuffer();
    const mime =
      res.headers.get("content-type") ||
      (format === "wav" ? "audio/wav" : "audio/mpeg");

    return { audioBase64: arrayBufferToBase64(audio), mime };
  }
}
