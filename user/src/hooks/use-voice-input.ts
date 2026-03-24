"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    onFinalTranscript,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const silenceTimerRef = useRef<number | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() != null);
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();

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
  }, [clearSilenceTimer]);

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

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = String(res?.[0]?.transcript ?? "");
        if (res?.isFinal) final += text;
        else interim += text;
      }

      finalTranscriptRef.current = final;
      setTranscript((final + interim).trim());
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

      const final = finalTranscriptRef.current.trim();
      if (final.length > 0) {
        setTranscript(final);
        onFinalTranscript?.(final);
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
  }, [clearSilenceTimer, lang, onError, onFinalTranscript, silenceMs, stop]);

  const toggle = useCallback(() => {
    if (isRecording) stop();
    else start();
  }, [isRecording, start, stop]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      try {
        recognitionRef.current?.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [clearSilenceTimer]);

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
