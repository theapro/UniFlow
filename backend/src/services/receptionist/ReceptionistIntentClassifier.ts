import type { LlmMessage } from "../ai/GroqChatService";
import { ReceptionistLlmService } from "./ReceptionistLlmService";
import { normalizeText } from "./receptionistText";

export type ReceptionistIntent =
  | "directions"
  | "location"
  | "schedule"
  | "knowledge"
  | "announcement"
  | "general";

export type IntentDecision = {
  intent: ReceptionistIntent;
  confidence: number; // 0..1
  rationale?: string;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function heuristicIntent(message: string): IntentDecision {
  const s = normalizeText(message).toLowerCase();

  const has = (re: RegExp) => re.test(s);

  // Directions: explicit navigation words and two-point phrasing.
  if (
    has(/\b(how\s+to\s+get|directions?|route|from\s+.+\s+to\s+.+)\b/) ||
    has(/\b(qanday\s+bor(am|ish)|qayerdan\s+.+\s+qayerga)\b/) ||
    has(/(行き方|道順|から.+まで)/)
  ) {
    return { intent: "directions", confidence: 0.72 };
  }

  // Location: where is X
  if (
    has(
      /\b(where\s+is|location\b|located\b|find\b|room\b|office\b|building\b)\b/,
    ) ||
    has(/\b(qayerda|qayerga|xona|kabinet|bino|kutubxona)\b/) ||
    has(/(どこ|場所|部屋|教室|事務室)/)
  ) {
    return { intent: "location", confidence: 0.66 };
  }

  // Schedule
  if (
    has(/\b(schedule|timetable|class\s+time|when\s+is|what\s+time)\b/) ||
    has(/\b(jadval|dars\s+qachon|qachon\s+dars|dars\s+vaqti)\b/) ||
    has(/(時間割|授業|いつ)/)
  ) {
    return { intent: "schedule", confidence: 0.66 };
  }

  // Announcements / news
  if (
    has(/\b(announcement|news|notice|update)\b/) ||
    has(/\b(e'lon|elon|yangilik)\b/) ||
    has(/(お知らせ|ニュース)/)
  ) {
    return { intent: "announcement", confidence: 0.62 };
  }

  // Knowledge base (admission / dorm / rules)
  if (
    has(/\b(admission|apply|requirements?|tuition|scholarship|dorm|rules)\b/) ||
    has(/\b(qabul|hujjat|kontrakt|stipendiya|yotoqxona|qoida)\b/) ||
    has(/(入学|出願|学費|奨学金|寮|規則)/)
  ) {
    return { intent: "knowledge", confidence: 0.6 };
  }

  return { intent: "general", confidence: 0.4 };
}

function safeJsonParse(input: string): any | null {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export class ReceptionistIntentClassifier {
  constructor(private readonly llm = new ReceptionistLlmService()) {}

  async classify(params: {
    message: string;
    useLlm?: boolean;
    abortSignal?: AbortSignal;
  }): Promise<IntentDecision> {
    const msg = normalizeText(params.message);
    if (!msg) return { intent: "general", confidence: 0 };

    const heuristic = heuristicIntent(msg);
    if (!params.useLlm) return heuristic;

    // Best-effort LLM classifier; fall back to heuristic.
    try {
      const system =
        "You are an intent classifier for a university AI receptionist. " +
        "Classify the USER_MESSAGE into exactly one intent: directions | location | schedule | knowledge | announcement | general. " +
        'Return JSON only: {"intent":"...","confidence":0.0,"rationale":"short"}.';

      const messages: LlmMessage[] = [
        { role: "system", content: system },
        { role: "user", content: `USER_MESSAGE:\n${msg}` },
      ];

      const res = await this.llm.chat({
        messages,
        temperature: 0,
        maxTokens: 120,
      });

      const json = safeJsonParse(String(res.content ?? "").trim());
      const intent = String(json?.intent ?? "").trim();
      const confidenceNum = Number(json?.confidence);

      const allowed: ReceptionistIntent[] = [
        "directions",
        "location",
        "schedule",
        "knowledge",
        "announcement",
        "general",
      ];

      const normalizedIntent = allowed.includes(intent as any)
        ? (intent as ReceptionistIntent)
        : heuristic.intent;

      const confidence =
        Number.isFinite(confidenceNum) &&
        confidenceNum >= 0 &&
        confidenceNum <= 1
          ? confidenceNum
          : heuristic.confidence;

      const rationale =
        typeof json?.rationale === "string" && json.rationale.trim()
          ? json.rationale.trim().slice(0, 220)
          : undefined;

      // Blend with heuristic a bit to keep stability.
      const blended = clamp01(0.6 * confidence + 0.4 * heuristic.confidence);

      return { intent: normalizedIntent, confidence: blended, rationale };
    } catch {
      return heuristic;
    }
  }
}
