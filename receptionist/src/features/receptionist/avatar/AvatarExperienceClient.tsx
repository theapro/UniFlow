"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { ReceptionistActions } from "../components/ReceptionistActions";
import { ReceptionistDebugModal } from "../components/ReceptionistDebugModal";
import { useAudioAnalyzer } from "../voice/useAudioAnalyzer";
import { useVoiceChat } from "../voice/use-voice-chat";
import { VrmAvatarStage, type ThreeDLeiaMode } from "./VrmAvatarStage";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function AvatarExperienceClient(props: {
  assistantName?: string;
  conversationId: string | null;
  modelUrl: string | null;
}) {
  const modelUrl =
    asString(props.modelUrl).trim() || "/receptionist/assets/3dleia/leia.vrm";

  const conversationIdRef = useRef<string | null>(props.conversationId);
  useEffect(() => {
    conversationIdRef.current = props.conversationId;
  }, [props.conversationId]);

  const analyzer = useAudioAnalyzer({
    fftSize: 1024,
    smoothingTimeConstant: 0.86,
  });

  const [debugLevels, setDebugLevels] = useState({ input: 0, output: 0 });

  useEffect(() => {
    const t = window.setInterval(() => {
      setDebugLevels({
        input: analyzer.inputLevelRef.current,
        output: analyzer.outputLevelRef.current,
      });
    }, 200);
    return () => window.clearInterval(t);
  }, [analyzer.inputLevelRef, analyzer.outputLevelRef, setDebugLevels]);

  const beginTurnRef = useRef<
    | ((params: { sessionId?: string; chatModel?: string }) => Promise<void>)
    | null
  >(null);
  const stopSpeakingRef = useRef<(() => void) | null>(null);

  const voiceStateRef = useRef({
    isProcessing: false,
    isRecording: false,
    isListening: false,
    isSpeaking: false,
    error: null as string | null,
  });

  const sessionActiveRef = useRef(true);
  const startedOnceRef = useRef(false);
  const bootingRef = useRef(false);

  const voiceApiRef = useRef<{
    beginTurn: (params: {
      sessionId?: string;
      chatModel?: string;
    }) => Promise<void>;
    unlockPlayback: () => Promise<boolean>;
    cancel: () => void;
  } | null>(null);

  const analyzerApiRef = useRef<{
    ensureContext: () => Promise<AudioContext | null>;
    stop: () => void;
  } | null>(null);

  const voice = useVoiceChat({
    endpoint: "/api/receptionist/voice",
    keepStreamAlive: true,
    maxDurationMs: 60000,
    silenceMs: 2000,
    onInputStream: (stream) => {
      void analyzer.setInputStream(stream);
      void analyzer.start();
    },
    onOutputAudioElement: (el) => {
      void analyzer.setOutputElement(el);
      void analyzer.start();
    },
  });

  useEffect(() => {
    voiceApiRef.current = {
      beginTurn: voice.beginTurn,
      unlockPlayback: voice.unlockPlayback,
      cancel: voice.cancel,
    };
  }, [voice.beginTurn, voice.cancel, voice.unlockPlayback]);

  useEffect(() => {
    analyzerApiRef.current = {
      ensureContext: analyzer.ensureContext,
      stop: analyzer.stop,
    };
  }, [analyzer.ensureContext, analyzer.stop]);

  useEffect(() => {
    beginTurnRef.current = voice.beginTurn;
    stopSpeakingRef.current = voice.stopSpeaking;
  }, [voice.beginTurn, voice.stopSpeaking]);

  useEffect(() => {
    voiceStateRef.current = {
      isProcessing: voice.isProcessing,
      isRecording: voice.isRecording,
      isListening: voice.isListening,
      isSpeaking: voice.isSpeaking,
      error: voice.error,
    };
  }, [
    voice.error,
    voice.isListening,
    voice.isProcessing,
    voice.isRecording,
    voice.isSpeaking,
  ]);

  useEffect(() => {
    sessionActiveRef.current = true;
    return () => {
      sessionActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Always-on kiosk mode: start listening immediately (no buttons).
    if (startedOnceRef.current) return;
    startedOnceRef.current = true;

    bootingRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        try {
          await analyzerApiRef.current?.ensureContext();
        } catch {
          // ignore
        }

        // Best-effort (may be blocked by autoplay policy; the hook will fallback).
        try {
          await voiceApiRef.current?.unlockPlayback();
        } catch {
          // ignore
        }

        if (cancelled) return;
        try {
          await voiceApiRef.current?.beginTurn({
            sessionId: conversationIdRef.current ?? undefined,
          });
        } catch {
          // ignore
        }
      } finally {
        bootingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      try {
        voiceApiRef.current?.cancel();
      } catch {
        // ignore
      }
      try {
        analyzerApiRef.current?.stop();
      } catch {
        // ignore
      }
    };
    // Intentionally dependency-free: voice/analyzer functions are not stable.
    // Using refs prevents effect cleanup from firing mid-session.
  }, []);

  // User-gesture retry: recover from blocked mic/audio or permission fixes.
  useEffect(() => {
    let lastAttemptAt = 0;

    const onGesture = () => {
      const now = Date.now();
      if (now - lastAttemptAt < 800) return;
      lastAttemptAt = now;

      if (!sessionActiveRef.current) return;
      if (bootingRef.current) return;

      const st = voiceStateRef.current;
      if (st.isListening || st.isRecording || st.isProcessing || st.isSpeaking)
        return;

      try {
        void voiceApiRef.current?.unlockPlayback();
      } catch {
        // ignore
      }

      try {
        void voiceApiRef.current?.beginTurn({
          sessionId: conversationIdRef.current ?? undefined,
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, []);

  // Continuous conversation: when fully idle, begin a new listening turn.
  useEffect(() => {
    if (!sessionActiveRef.current) return;
    if (!startedOnceRef.current) return;
    if (bootingRef.current) return;

    if (
      voice.isSpeaking ||
      voice.isProcessing ||
      voice.isListening ||
      voice.isRecording
    ) {
      return;
    }

    const err = (voice.error ?? "").toLowerCase();
    const fatalMicError =
      err.includes("permission denied") ||
      err.includes("failed to access microphone");
    if (fatalMicError) return;

    const delay = voice.error ? 1500 : 120;
    const t = window.setTimeout(() => {
      if (!sessionActiveRef.current) return;
      void beginTurnRef.current?.({
        sessionId: conversationIdRef.current ?? undefined,
      });
    }, delay);

    return () => {
      window.clearTimeout(t);
    };
  }, [
    voice.error,
    voice.isListening,
    voice.isProcessing,
    voice.isRecording,
    voice.isSpeaking,
  ]);

  const avatarMode: ThreeDLeiaMode = useMemo(() => {
    if (voice.isSpeaking) return "speaking";
    if (voice.isProcessing) return "processing";
    if (voice.isListening || voice.isRecording) return "listening";
    return "idle";
  }, [
    voice.isListening,
    voice.isProcessing,
    voice.isRecording,
    voice.isSpeaking,
  ]);

  // Barge-in interrupt: if user starts speaking while AI is speaking, stop immediately.
  useEffect(() => {
    if (!voice.isSpeaking) return;

    let raf: number | null = null;
    let aboveSince: number | null = null;

    const threshold = 0.14;
    const requiredMs = 180;

    const tick = async () => {
      if (!sessionActiveRef.current) return;
      if (!voiceStateRef.current.isSpeaking) return;
      if (
        voiceStateRef.current.isProcessing ||
        voiceStateRef.current.isRecording ||
        voiceStateRef.current.isListening
      )
        return;

      const level = analyzer.inputLevelRef.current;
      const now = Date.now();

      if (level >= threshold) {
        if (aboveSince == null) aboveSince = now;
        if (now - aboveSince >= requiredMs) {
          try {
            stopSpeakingRef.current?.();
            await beginTurnRef.current?.({
              sessionId: conversationIdRef.current ?? undefined,
            });
          } catch {
            // ignore
          }
          return;
        }
      } else {
        aboveSince = null;
      }

      raf = window.requestAnimationFrame(() => {
        void tick();
      });
    };

    raf = window.requestAnimationFrame(() => {
      void tick();
    });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [analyzer.inputLevelRef, voice.isSpeaking]);

  const [avatarLoaded, setAvatarLoaded] = React.useState(false);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);

  const voiceUiError =
    voice.error && voice.error !== "No speech detected" ? voice.error : null;

  const debugStateLabel = voice.isSpeaking
    ? "speaking"
    : voice.isProcessing
      ? "thinking"
      : voice.isListening || voice.isRecording
        ? "listening"
        : "idle";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />

      <ReceptionistActions
        active="avatar"
        chatHref="/receptionist/avatar/chat"
      />

      <div className="relative mx-auto flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10">
        <div>
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))]",
              voice.isSpeaking
                ? "from-foreground/12 via-transparent to-transparent"
                : voice.isProcessing || voice.isListening || voice.isRecording
                  ? "from-foreground/10 via-transparent to-transparent"
                  : "from-foreground/6 via-transparent to-transparent",
            )}
          />

          <VrmAvatarStage
            mode={avatarMode}
            speakingLevelRef={analyzer.outputLevelRef}
            listeningLevelRef={analyzer.inputLevelRef}
            speakingFrequencyDataRef={analyzer.outputFrequencyDataRef}
            listeningFrequencyDataRef={analyzer.inputFrequencyDataRef}
            modelUrl={modelUrl}
            onStatus={(s) => {
              setAvatarLoaded(s.loaded);
              setAvatarError(s.error);
            }}
          />
        </div>

        {/* Minimal errors only (clean UI) */}
        {voiceUiError || avatarError ? (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {avatarError ? "Avatar failed to load" : null}
            {avatarError && voiceUiError ? " · " : null}
            {voiceUiError ? voiceUiError : null}
          </div>
        ) : null}

        {/* Hidden status hook: keeps component responsive to loading state */}
        <div className="sr-only">{avatarLoaded ? "loaded" : "loading"}</div>
      </div>

      <ReceptionistDebugModal
        enabled
        title="AVATAR DEBUG"
        showAvatarTransformControls
        fields={[
          { label: "state", value: debugStateLabel },
          {
            label: "conversationId",
            value: props.conversationId ?? "(none)",
          },
          { label: "modelUrl", value: modelUrl },
          {
            label: "avatarMode",
            value: avatarMode,
          },
          { label: "avatarLoaded", value: String(avatarLoaded) },
          { label: "avatarError", value: avatarError ?? "" },
          {
            label: "secureContext",
            value:
              typeof window === "undefined"
                ? "(server)"
                : String((window as any).isSecureContext ?? false),
          },
          { label: "isListening", value: String(Boolean(voice.isListening)) },
          { label: "isRecording", value: String(Boolean(voice.isRecording)) },
          {
            label: "isProcessing",
            value: String(Boolean(voice.isProcessing)),
          },
          { label: "isSpeaking", value: String(Boolean(voice.isSpeaking)) },
          { label: "muted", value: String(Boolean(voice.isMuted)) },
          {
            label: "inputLevel(analyzer)",
            value: debugLevels.input.toFixed(3),
          },
          {
            label: "outputLevel(analyzer)",
            value: debugLevels.output.toFixed(3),
          },
          {
            label: "hook.listeningLevel",
            value: Number(voice.listeningLevel ?? 0).toFixed(3),
          },
          {
            label: "hook.speakingLevel",
            value: Number(voice.speakingLevel ?? 0).toFixed(3),
          },
          { label: "error", value: voice.error ?? "" },
          { label: "dbg.lastEvent", value: voice.debugInfo?.lastEvent ?? "" },
          {
            label: "dbg.stopReason",
            value: voice.debugInfo?.lastStopReason ?? "",
          },
          {
            label: "dbg.recorderState",
            value: voice.debugInfo?.recorderState ?? "",
          },
          { label: "dbg.mime", value: voice.debugInfo?.recorderMimeType ?? "" },
          {
            label: "dbg.streamActive",
            value: String(Boolean(voice.debugInfo?.streamActive)),
          },
          { label: "dbg.chunks", value: String(voice.debugInfo?.chunks ?? 0) },
          {
            label: "dbg.lastBlobBytes",
            value: String(voice.debugInfo?.lastBlobBytes ?? 0),
          },
        ]}
        textBlocks={[
          { label: "transcript", value: voice.transcript ?? "" },
          { label: "response", value: voice.response ?? "" },
        ]}
        json={voice.debugInfo ?? null}
      />
    </main>
  );
}
