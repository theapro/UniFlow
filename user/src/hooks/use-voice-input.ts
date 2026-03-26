"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function normalizeTranscript(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseTranscript(input: string): boolean {
  const s = normalizeTranscript(input).toLowerCase();
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

function getConfidence(result: any): number {
  const c =
    typeof result?.[0]?.confidence === "number" ? result[0].confidence : NaN;
  if (!Number.isFinite(c)) return 0;
  return Math.max(0, Math.min(1, c));
}

export type VoiceInputError =
  | "not-supported"
  | "permission-denied"
  | "no-speech"
  | "aborted"
  | "network"
  | "audio-capture"
  | "unknown";

export type UseVoiceInputOptions = {
  lang?: string;
  silenceMs?: number; // optional auto-stop after silence
  debounceMs?: number; // debounce final transcript emission
  onFinalTranscript?: (text: string) => void;
  onError?: (message: string, code: VoiceInputError) => void;
};

function getSpeechRecognitionConstructor(): any {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

function mapSpeechError(err: any): { code: VoiceInputError; message: string } {
  const code = String(err?.error ?? "unknown");

  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return {
        code: "permission-denied",
        message: "Microphone permission denied",
      };
    case "no-speech":
      return { code: "no-speech", message: "No speech detected" };
    case "aborted":
      return { code: "aborted", message: "Voice input aborted" };
    case "network":
      return { code: "network", message: "Network error during voice input" };
    case "audio-capture":
      return { code: "audio-capture", message: "No microphone found" };
    default:
      return { code: "unknown", message: "Voice input error" };
  }
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    lang = "en-US",
    silenceMs = 2500,
    debounceMs = 400,
    onFinalTranscript,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const finalConfidenceRef = useRef<number>(0);
  const silenceTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const lastSentRef = useRef<string>("");
  const lastSentAtRef = useRef<number>(0);

  const clearSilenceTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearDebounceTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() != null);
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    clearDebounceTimer();

    const rec = recognitionRef.current;
    if (!rec) {
      setIsRecording(false);
      return;
    }

    try {
      rec.stop?.();
    } catch {
      try {
        rec.abort?.();
      } catch {
        // ignore
      }
    }
  }, [clearDebounceTimer, clearSilenceTimer]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      const msg = "Voice input is not supported in this browser";
      setError(msg);
      onError?.(msg, "not-supported");
      console.warn(msg);
      return;
    }

    setError(null);
    setTranscript("");
    finalTranscriptRef.current = "";
    finalConfidenceRef.current = 0;
    clearDebounceTimer();

    const rec = new Ctor();
    recognitionRef.current = rec;

    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;

    const resetSilenceTimer = () => {
      clearSilenceTimer();
      if (typeof window === "undefined") return;
      silenceTimerRef.current = window.setTimeout(() => {
        // Optional auto-stop after silence
        stop();
      }, silenceMs);
    };

    rec.onstart = () => {
      setIsRecording(true);
      resetSilenceTimer();
    };

    rec.onresult = (event: any) => {
      resetSilenceTimer();

      let interim = "";
      let final = finalTranscriptRef.current;
      let bestFinalConfidence = finalConfidenceRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = String(res?.[0]?.transcript ?? "");
        const conf = getConfidence(res);
        if (res?.isFinal) {
          const cleaned = normalizeTranscript(text);
          // Ignore ghost / random / low-confidence transcripts
          if (conf >= 0.7 && !isNoiseTranscript(cleaned)) {
            final += (final ? " " : "") + cleaned;
            bestFinalConfidence = Math.max(bestFinalConfidence, conf);
          }
        } else {
          interim += text;
        }
      }

      finalTranscriptRef.current = final;
      finalConfidenceRef.current = bestFinalConfidence;
      setTranscript(normalizeTranscript(final + " " + interim));
    };

    rec.onspeechend = () => {
      // stop when speech ends
      stop();
    };

    rec.onerror = (e: any) => {
      const mapped = mapSpeechError(e);
      setError(mapped.message);
      onError?.(mapped.message, mapped.code);
      console.warn("Voice input error:", mapped.code, e);
      stop();
    };

    rec.onend = () => {
      clearSilenceTimer();
      setIsRecording(false);

      const final = normalizeTranscript(finalTranscriptRef.current);
      const conf = finalConfidenceRef.current;

      // Allow short meaningful utterances with slightly lower confidence.
      const minConf = final.length < 4 ? 0.4 : 0.55;

      if (final.length > 0 && conf >= minConf && !isNoiseTranscript(final)) {
        setTranscript(final);

        const now = Date.now();
        const normalized = final.toLowerCase();
        const isDuplicate =
          normalized === lastSentRef.current &&
          now - lastSentAtRef.current < 2500;

        if (!isDuplicate) {
          clearDebounceTimer();
          if (typeof window !== "undefined") {
            debounceTimerRef.current = window.setTimeout(
              () => {
                lastSentRef.current = normalized;
                lastSentAtRef.current = Date.now();
                onFinalTranscript?.(final);
              },
              Math.min(Math.max(debounceMs, 300), 500),
            );
          } else {
            onFinalTranscript?.(final);
          }
        }
      }

      recognitionRef.current = null;
    };

    try {
      rec.start();
    } catch (e) {
      const msg = "Failed to start voice input";
      setError(msg);
      onError?.(msg, "unknown");
      console.warn(msg, e);
      setIsRecording(false);
      recognitionRef.current = null;
    }
  }, [
    clearDebounceTimer,
    clearSilenceTimer,
    debounceMs,
    lang,
    onError,
    onFinalTranscript,
    silenceMs,
    stop,
  ]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      clearDebounceTimer();
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [clearDebounceTimer, clearSilenceTimer]);

  return {
    isRecording,
    transcript,
    error,
    start,
    stop,
    toggle,
    isSupported,
  };
}
