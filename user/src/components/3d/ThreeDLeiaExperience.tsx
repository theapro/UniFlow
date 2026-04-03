"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { useChatStore } from "@/store/chatStore";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { cn, generateId } from "@/lib/utils";

import { AvatarScene } from "@/components/3d/AvatarScene";
import type { AvatarMode } from "@/components/3d/AvatarModel";
import { TopBar } from "@/components/ui/TopBar";
import { Controls } from "@/components/ui/Controls";

export type ThreeDLeiaConfig = {
  title: string;
  modelUrl: string;
  modelOffset?: [number, number, number];
};

export function ThreeDLeiaExperience(props: { config: ThreeDLeiaConfig }) {
  const { config } = props;

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

  const [debugOpen, setDebugOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const sessionActiveRef = useRef(false);

  const [lastLatencyMs, setLastLatencyMs] = useState(0);

  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const cursorRef = useRef({ x: 0, y: 0 });

  const analyzer = useAudioAnalyzer({
    fftSize: 1024,
    smoothingTimeConstant: 0.86,
  });

  useEffect(() => {
    if (sessions.length === 0) loadSessions().catch(console.error);
    if (models.length === 0) loadModels().catch(console.error);
  }, [loadModels, loadSessions, models.length, sessions.length]);

  useEffect(() => {
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      // Normalize to -1..1
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;

      // Throttle via RAF to avoid spamming.
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        cursorRef.current = {
          x: clamp(nx),
          y: clamp(ny),
        };
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
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
        // ignore
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
      } catch {
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

    const threshold = 0.14;
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
  ]);

  const start = useCallback(async () => {
    if (voice.isProcessing || voice.isListening || voice.isRecording) return;

    try {
      turnStartedAtRef.current = Date.now();

      sessionActiveRef.current = true;
      setSessionActive(true);

      // Must happen under user interaction to satisfy autoplay policies.
      await voice.unlockPlayback();

      const sessionId = await ensureSessionId();
      lastTurnSessionIdRef.current = sessionId;

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
      console.error("[3d-leia] failed to start", e);
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

  const onToggleMic = useCallback(async () => {
    if (
      voice.isProcessing ||
      voice.isSpeaking ||
      voice.isListening ||
      voice.isRecording
    ) {
      stopSession();
      return;
    }

    await start();
  }, [
    start,
    stopSession,
    voice.isListening,
    voice.isProcessing,
    voice.isRecording,
    voice.isSpeaking,
  ]);

  const avatarMode: AvatarMode = useMemo(() => {
    if (voice.isProcessing) return "processing";
    if (voice.isSpeaking) return "speaking";
    if (voice.isListening || voice.isRecording) return "listening";
    return "idle";
  }, [
    voice.isListening,
    voice.isProcessing,
    voice.isSpeaking,
    voice.isRecording,
  ]);

  const isMicActive =
    voice.isListening ||
    voice.isRecording ||
    voice.isSpeaking ||
    voice.isProcessing;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 overflow-hidden",
        "bg-background text-foreground",
      )}
    >
      {/* Gradient base behind the transparent canvas */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          "bg-gradient-to-b from-background via-muted/20 to-background",
        )}
      />

      {/* Soft center glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0",
          "bg-[radial-gradient(60%_60%_at_55%_38%,hsl(var(--foreground)_/_0.06)_0%,transparent_60%)]",
        )}
      />

      {/* Fullscreen Canvas */}
      <AvatarScene
        modelUrl={config.modelUrl}
        mode={avatarMode}
        speakingLevelRef={analyzer.outputLevelRef}
        listeningLevelRef={analyzer.inputLevelRef}
        cursorRef={cursorRef}
        offset={config.modelOffset}
        onStatus={(s) => {
          setAvatarLoaded(s.loaded);
          setAvatarError(s.error);
        }}
      />

      {/* Vignette overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_55%,hsl(var(--background)_/_0.92)_100%)]",
        )}
      />

      {/* Overlay UI layer */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <TopBar title={config.title} />

        <Controls
          micActive={isMicActive}
          micDisabled={voice.isProcessing && !sessionActive}
          onToggleMic={onToggleMic}
          debugOpen={debugOpen}
          onDebugOpenChange={setDebugOpen}
          audioSnapshot={analyzer.snapshot}
          avatarStatus={{ loaded: avatarLoaded, error: avatarError }}
          voiceDebug={{
            lastEvent: voice.debugInfo.lastEvent,
            lastStopReason: voice.debugInfo.lastStopReason,
            recorderState: voice.debugInfo.recorderState,
            chunks: voice.debugInfo.chunks,
            lastBlobBytes: voice.debugInfo.lastBlobBytes,
            isRecording: voice.isRecording,
            isProcessing: voice.isProcessing,
            isSpeaking: voice.isSpeaking,
            latencyMs: lastLatencyMs,
          }}
        />
      </div>
    </div>
  );
}

function clamp(n: number) {
  return Math.max(-1, Math.min(1, n));
}
