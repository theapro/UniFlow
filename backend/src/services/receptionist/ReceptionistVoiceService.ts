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

function asSttLanguageCode(raw: unknown): string {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "UZ") return "uz";
  if (v === "EN") return "en";
  if (v === "JP" || v === "JA") return "ja";
  return "";
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
    language?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ text: string }> {
    const apiKey = this.requireGroqKey();

    const language = asSttLanguageCode(params.language);

    const run = async (opts: {
      withLanguage: boolean;
      withTemperature: boolean;
    }) => {
      const form = new FormData();

      // DOM typings for BlobPart don't accept Node Buffer (it can be backed by SharedArrayBuffer).
      // Copy into a plain ArrayBuffer for type-safety and broad compatibility.
      const arrayBuffer = new ArrayBuffer(params.audioBytes.byteLength);
      new Uint8Array(arrayBuffer).set(params.audioBytes);
      const blob = new Blob([arrayBuffer], { type: params.mimeType });

      form.set("file", blob, params.filename || "audio.webm");
      form.set("model", params.model ?? "whisper-large-v3-turbo");
      form.set("response_format", "json");
      if (opts.withTemperature) form.set("temperature", "0");
      if (opts.withLanguage && language) {
        form.set("language", language);
      }

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
    };

    const attempts: Array<{ withLanguage: boolean; withTemperature: boolean }> =
      [
        { withLanguage: true, withTemperature: true },
        { withLanguage: false, withTemperature: true },
        { withLanguage: true, withTemperature: false },
        { withLanguage: false, withTemperature: false },
      ];

    let firstError: unknown = null;
    for (const a of attempts) {
      try {
        return await run(a);
      } catch (e) {
        if (!firstError) firstError = e;
      }
    }

    throw firstError;
  }

  async tts(params: {
    text: string;
    model?: string;
    voice?: string;
    format?: "mp3" | "wav";
    abortSignal?: AbortSignal;
  }): Promise<{ audioBase64: string; mime: string }> {
    const apiKey = this.requireGroqKey();

    const preferredModel = pickFirstNonEmpty(
      params.model,
      process.env.GROQ_TTS_MODEL,
      "canopylabs/orpheus-v1-english",
    );

    const preferredVoice = pickFirstNonEmpty(
      params.voice,
      process.env.GROQ_TTS_VOICE,
      "hannah",
    )
      .trim()
      .toLowerCase();

    const voiceCandidates = Array.from(
      new Set([preferredVoice, "hannah", "diana", "autumn"].filter(Boolean)),
    );

    const responseFormat = (params.format ?? "wav") as "mp3" | "wav";

    const modelsToTry =
      preferredModel === "canopylabs/orpheus-v1-english"
        ? [preferredModel]
        : [preferredModel, "canopylabs/orpheus-v1-english"];

    let lastFailure: {
      status: number;
      statusText: string;
      errText: string;
      model: string;
      voice: string;
    } | null = null;

    for (const model of modelsToTry) {
      for (const voice of voiceCandidates) {
        const res = await fetch(`${this.groqBaseUrl}/audio/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: params.text,
            voice,
            response_format: responseFormat,
          }),
          signal: params.abortSignal,
        });

        if (!res.ok) {
          const errText = await readTextSafe(res);
          lastFailure = {
            status: res.status,
            statusText: res.statusText,
            errText,
            model,
            voice,
          };
          continue;
        }

        const audio = await res.arrayBuffer();
        const mime =
          res.headers.get("content-type") ||
          (responseFormat === "wav" ? "audio/wav" : "audio/mpeg");

        return { audioBase64: arrayBufferToBase64(audio), mime };
      }
    }

    const meta = lastFailure
      ? `:${lastFailure.model}:${lastFailure.voice}:${lastFailure.errText}`
      : "";

    throw new Error(
      `TTS_FAILED:${lastFailure?.status ?? 500}:${
        lastFailure?.statusText ?? "Unknown"
      }${meta}`.slice(0, 4000),
    );
  }
}
