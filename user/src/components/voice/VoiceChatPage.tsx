"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChatStore } from "@/store/chatStore";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { Button } from "@/components/ui/button";
import { cn, generateId } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bug,
  GripVertical,
  Mic,
  Settings2,
  Square,
  X,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

import { ParticleSphere } from "@/components/voice/ParticleSphere";
import { RingSphere } from "@/components/voice/RingSphere";
import { WaveformSphere } from "@/components/voice/WaveformSphere";

type SphereType = "particle" | "ring" | "waveform";

export function VoiceChatPage() {
  const {
    sessions,
    currentSessionId,
    models,
    selectedModelId,
    loadSessions,
    loadModels,
    createSession,
    setCurrentSession,
    addMessage,
  } = useChatStore();

  const selectedModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId)
    : null;
  const lastTurnSessionIdRef = useRef<string | null>(null);
  const turnStartedAtRef = useRef<number | null>(null);

  const [sphereType, setSphereType] = useState<SphereType>("particle");
  const [lastLatencyMs, setLastLatencyMs] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const sessionActiveRef = useRef(false);

  const DEBUG_KEY = "uniflow.voice.debug";

  const setDebugOpenPersist = useCallback((next: boolean) => {
    setDebugOpen(next);
    try {
      localStorage.setItem(DEBUG_KEY, next ? "true" : "false");
    } catch {
      // ignore
    }
  }, []);

  const cycleSphereType = useCallback(() => {
    setSphereType((prev) => {
      if (prev === "particle") return "ring";
      if (prev === "ring") return "waveform";
      return "particle";
    });
  }, []);

  const analyzer = useAudioAnalyzer({
    fftSize: 1024,
    smoothingTimeConstant: 0.86,
  });

  useEffect(() => {
    if (sessions.length === 0) loadSessions().catch(console.error);
    if (models.length === 0) loadModels().catch(console.error);
  }, [loadModels, loadSessions, models.length, sessions.length]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(DEBUG_KEY);
      if (v === "true") setDebugOpen(true);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureSessionId = useCallback(async (): Promise<string> => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      setCurrentSession(sessionId);
    }
    return sessionId;
  }, [createSession, currentSessionId, setCurrentSession]);

  const persistTurn = useCallback(
    async (params: { sessionId: string; transcript: string; text: string }) => {
      const base = `/api/chat/sessions/${encodeURIComponent(params.sessionId)}/messages`;
      const write = async (sender: "USER" | "ASSISTANT", message: string) => {
        await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sender, message }),
        });
      };
      await write("USER", params.transcript);
      await write("ASSISTANT", params.text);
    },
    [],
  );

  const voice = useVoiceChat({
    keepStreamAlive: true,
    onInputStream: (stream) => {
      analyzer.setInputStream(stream);
      analyzer.start();
    },
    onOutputAudioElement: (el) => {
      analyzer.setOutputElement(el);
      analyzer.start();
    },
    onSpeakingEnded: async () => {
      // Continuous conversation mode: after AI finishes speaking, start listening again.
      if (!sessionActiveRef.current) return;
      if (voice.isProcessing || voice.isRecording || voice.isListening) return;

      try {
        await new Promise((r) => setTimeout(r, 120));
        const sessionId = await ensureSessionId();
        await voice.beginTurn({
          sessionId,
          chatModel: selectedModel?.model,
        });
      } catch {
        // If restart fails, keep sessionActive true; user can tap to resume.
      }
    },
    onResult: async (result) => {
      const startedAt = turnStartedAtRef.current;
      const latencyMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
      setLastLatencyMs(latencyMs);

      const sessionId =
        lastTurnSessionIdRef.current ?? (await ensureSessionId());
      addMessage(sessionId, {
        id: generateId(),
        role: "user",
        content: result.transcript,
        createdAt: new Date(),
      });
      addMessage(sessionId, {
        id: generateId(),
        role: "assistant",
        content: result.text,
        createdAt: new Date(),
      });
      try {
        await persistTurn({
          sessionId,
          transcript: result.transcript,
          text: result.text,
        });
      } catch (e) {
        toast.error("Failed to save history");
      }
    },
    onError: (msg) => toast.error(msg),
    maxDurationMs: 60000,
    silenceMs: 2000,
  });

  // Barge-in: if user starts speaking while AI is speaking, interrupt immediately.
  useEffect(() => {
    if (!sessionActive) return;
    if (!voice.isSpeaking) return;

    let raf: number | null = null;
    let aboveSince: number | null = null;

    const threshold = 0.14; // tuned for analyzer's 0..1 level
    const requiredMs = 180;

    const tick = async () => {
      if (!sessionActiveRef.current) return;
      if (!voice.isSpeaking) return;
      if (voice.isProcessing || voice.isRecording || voice.isListening) return;

      const level = analyzer.inputLevelRef.current;
      const now = Date.now();

      if (level >= threshold) {
        if (aboveSince == null) aboveSince = now;
        if (now - aboveSince >= requiredMs) {
          // Interrupt
          try {
            voice.stopSpeaking();
            const sessionId = await ensureSessionId();
            await voice.beginTurn({
              sessionId,
              chatModel: selectedModel?.model,
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
  }, [
    analyzer.inputLevelRef,
    ensureSessionId,
    selectedModel?.model,
    sessionActive,
    voice,
    voice.beginTurn,
    voice.isListening,
    voice.isProcessing,
    voice.isRecording,
    voice.isSpeaking,
    voice.stopSpeaking,
  ]);

  const isAnyActive =
    voice.isListening ||
    voice.isSpeaking ||
    voice.isProcessing ||
    voice.isRecording;

  const statusLabel = voice.isProcessing
    ? "Thinking..."
    : voice.isSpeaking
      ? "AI is speaking"
      : voice.isListening || voice.isRecording
        ? "Listening..."
        : "Tap to start conversation";

  const start = useCallback(async () => {
    if (voice.isProcessing || voice.isListening || voice.isRecording) return;

    try {
      turnStartedAtRef.current = Date.now();

      sessionActiveRef.current = true;
      setSessionActive(true);

      // Must happen under user interaction to satisfy autoplay policies.
      await voice.unlockPlayback();

      // Ensure we have a stable sessionId for conversation memory.
      const sessionId = await ensureSessionId();
      lastTurnSessionIdRef.current = sessionId;

      // Kick audio context resume, but don't block microphone start.
      void analyzer
        .ensureContext()
        .then(() => analyzer.start())
        .catch(() => {
          // ignore
        });

      await voice.beginTurn({
        sessionId,
        chatModel: selectedModel?.model,
      });
    } catch (e) {
      console.error("[voice] failed to start", e);
      toast.error("Failed to start recording");
    }
  }, [analyzer, ensureSessionId, selectedModel?.model, voice]);

  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    try {
      voice.cancel();
    } catch {
      // ignore
    }
  }, [voice]);

  const vizMode = useMemo(() => {
    if (voice.isProcessing) return "processing" as const;
    if (voice.isSpeaking) return "speaking" as const;
    if (voice.isListening || voice.isRecording) return "speaking" as const;
    return "idle" as const;
  }, [
    voice.isListening,
    voice.isProcessing,
    voice.isSpeaking,
    voice.isRecording,
  ]);

  const activeLevelRef = voice.isSpeaking
    ? analyzer.outputLevelRef
    : voice.isListening || voice.isRecording
      ? analyzer.inputLevelRef
      : analyzer.inputLevelRef;

  const activeFrequencyRef = voice.isSpeaking
    ? analyzer.outputFrequencyDataRef
    : voice.isListening || voice.isRecording
      ? analyzer.inputFrequencyDataRef
      : analyzer.inputFrequencyDataRef;

  const transcriptPreview = (voice.transcript || "").slice(0, 180);
  const responsePreview = (voice.response || "").slice(0, 180);

  const sphereLabel = useMemo(() => {
    if (sphereType === "particle") return "Particles";
    if (sphereType === "ring") return "Ring";
    return "Waveform";
  }, [sphereType]);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center min-h-0 overflow-hidden">
      {/* Minimal dark background (no blue accents) */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black via-zinc-950 to-black" />
      <div
        className={cn(
          "absolute inset-0 -z-10",
          "bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))]",
          vizMode === "speaking"
            ? "from-white/10 via-transparent to-transparent"
            : vizMode === "processing"
              ? "from-white/7 via-transparent to-transparent"
              : "from-white/5 via-transparent to-transparent",
        )}
      />

      {/* Corner dropdown selector */}
      <div className="absolute right-4 top-4 z-20">
        <Button
          type="button"
          variant="ghost"
          onClick={cycleSphereType}
          className={cn(
            "h-10 rounded-full",
            "border border-white/10 bg-white/5 backdrop-blur-xl",
            "text-zinc-200 hover:bg-white/10",
          )}
          aria-label="Change sphere style"
        >
          <Settings2 className="mr-2 size-4" />
          <span className="text-sm">{sphereLabel}</span>
        </Button>
      </div>

      {/* Center stage (no card behind the sphere) */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="flex items-center justify-center min-h-[300px]">
          {sphereType === "particle" ? (
            <ParticleSphere
              mode={vizMode}
              levelRef={activeLevelRef}
              frequencyDataRef={activeFrequencyRef}
            />
          ) : sphereType === "ring" ? (
            <RingSphere
              mode={vizMode}
              levelRef={activeLevelRef}
              frequencyDataRef={activeFrequencyRef}
            />
          ) : (
            <WaveformSphere
              mode={vizMode}
              levelRef={activeLevelRef}
              frequencyDataRef={activeFrequencyRef}
            />
          )}
        </div>

        <div className="mt-6 text-center">
          <div className="text-xs text-zinc-400">
            {selectedModel?.displayName ?? "Model"}
          </div>
          <div
            className={cn(
              "mt-1 text-sm font-medium",
              isAnyActive ? "text-white" : "text-zinc-300",
            )}
          >
            {statusLabel}
          </div>
        </div>

        {/* Controls (premium minimal glass buttons) */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={async () => {
              // Stop is the only way to end the session.
              if (voice.isProcessing) {
                stopSession();
                return;
              }

              if (voice.isSpeaking) {
                // While speaking, tapping stops the session.
                stopSession();
                return;
              }

              // If we're already listening/recording, treat this as "Stop" (end session).
              if (voice.isListening || voice.isRecording) {
                stopSession();
                return;
              }

              // Idle -> start session.
              await start();
            }}
            disabled={voice.isProcessing && !sessionActive}
            className={cn(
              "h-20 w-20 rounded-full",
              "border border-white/10 bg-white text-black",
              "shadow-[0_20px_70px_rgba(0,0,0,0.6)]",
              "transition-transform active:scale-95",
              "hover:bg-zinc-100",
              voice.isProcessing && !sessionActive ? "opacity-70" : "",
            )}
            aria-label={
              voice.isListening || voice.isRecording
                ? "Stop"
                : voice.isSpeaking
                  ? "Interrupt"
                  : "Start voice"
            }
          >
            {voice.isProcessing ? (
              <Loader2 className="size-8 animate-spin" />
            ) : voice.isListening || voice.isRecording || voice.isSpeaking ? (
              <Square className="size-8 fill-current" />
            ) : (
              <Mic className="size-8" />
            )}
          </Button>
        </div>
      </div>

      {/* Debug panel (toggle + draggable) */}
      {debugOpen ? (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.06}
          className={cn(
            "fixed bottom-4 right-4 z-30 w-[340px] max-w-[92vw]",
            "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl",
            "shadow-[0_14px_60px_rgba(0,0,0,0.55)]",
            "p-3",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 text-zinc-400" />
              <div className="text-xs font-semibold text-zinc-200">Debug</div>
            </div>
            <button
              type="button"
              onClick={() => setDebugOpenPersist(false)}
              className={cn(
                "rounded-full p-1.5",
                "text-zinc-300 hover:bg-white/10",
              )}
              aria-label="Close debug"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-2 grid gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">lastEvent</span>
              <span className="text-zinc-200">{voice.debugInfo.lastEvent}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">stopReason</span>
              <span className="text-zinc-200">
                {voice.debugInfo.lastStopReason}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">recorderState</span>
              <span className="text-zinc-200">
                {voice.debugInfo.recorderState}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">mime</span>
              <span className="text-zinc-200">
                {voice.debugInfo.recorderMimeType || "(default)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">isRecording</span>
              <span className="text-zinc-200">{String(voice.isRecording)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">isProcessing</span>
              <span className="text-zinc-200">
                {String(voice.isProcessing)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">isSpeaking</span>
              <span className="text-zinc-200">{String(voice.isSpeaking)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">latency</span>
              <span className="text-zinc-200">{lastLatencyMs} ms</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">chunks</span>
              <span className="text-zinc-200">{voice.debugInfo.chunks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">lastBlobBytes</span>
              <span className="text-zinc-200">
                {voice.debugInfo.lastBlobBytes}
              </span>
            </div>

            <div className="mt-2">
              <div className="text-zinc-400">tracks</div>
              <div className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-zinc-200">
                {voice.debugInfo.trackStates.length === 0
                  ? "(none)"
                  : voice.debugInfo.trackStates
                      .map(
                        (t) =>
                          `${t.kind}:${t.readyState}:${t.enabled ? "on" : "off"}`,
                      )
                      .join(" | ")}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">inputLevel</span>
              <span className="text-zinc-200">
                {Math.round(analyzer.snapshot.inputLevel * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">outputLevel</span>
              <span className="text-zinc-200">
                {Math.round(analyzer.snapshot.outputLevel * 100)}%
              </span>
            </div>

            <div className="mt-2">
              <div className="text-zinc-400">transcript</div>
              <div className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-zinc-200">
                {transcriptPreview || "(empty)"}
              </div>
            </div>

            <div className="mt-1">
              <div className="text-zinc-400">AI response</div>
              <div className="mt-1 rounded-lg border border-white/10 bg-black/20 p-2 text-zinc-200">
                {responsePreview || "(empty)"}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <button
          type="button"
          onClick={() => setDebugOpenPersist(true)}
          className={cn(
            "fixed bottom-4 right-4 z-30",
            "rounded-full border border-white/10 bg-white/5 backdrop-blur-xl",
            "px-3 py-2 text-xs font-medium text-zinc-200",
            "shadow-[0_14px_50px_rgba(0,0,0,0.55)]",
            "hover:bg-white/10",
          )}
          aria-label="Open debug"
        >
          <span className="inline-flex items-center gap-2">
            <Bug className="size-4" />
            Debug
          </span>
        </button>
      )}
    </div>
  );
}
