import { ReceptionistLanguage } from "@prisma/client";

export function normalizeText(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Some LLMs (e.g., reasoning models) emit hidden thoughts wrapped in <think>...</think>.
// We never want to store/speak/display those.
export function stripThinkBlocks(input: string): string {
  const s = String(input ?? "");

  // Remove full blocks first (multiline-safe).
  let out = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");

  // Remove any stray tags if the model produced malformed markup.
  out = out.replace(/<\/?think\b[^>]*>/gi, "");

  // Clean up excessive blank lines that can remain after stripping.
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

export function detectReceptionistLanguage(
  input: string,
): ReceptionistLanguage {
  const s = String(input ?? "");

  // Japanese (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(s)) return "JP";

  // Uzbek-specific Cyrillic characters
  if (/[ЎўҚқҒғҲҳ]/.test(s)) return "UZ";

  const lower = s.toLowerCase();
  if (
    /(\bjadval\b|\bdavomat\b|\bbaho\b|\bdars\b|\bqayer\b|\bqanday\b)/.test(
      lower,
    )
  ) {
    return "UZ";
  }

  return "EN";
}

export function coerceReceptionistLanguage(
  raw: unknown,
  fallback: ReceptionistLanguage,
): ReceptionistLanguage {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "UZ") return "UZ";
  if (v === "EN") return "EN";
  if (v === "JP" || v === "JA" || v === "JAP" || v === "JPN") return "JP";
  return fallback;
}

export function stripDangerousWhitespace(s: string): string {
  return String(s ?? "").replace(/[\r\u0000]/g, "");
}
