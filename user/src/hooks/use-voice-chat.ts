"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ~100ms silent WAV for autoplay priming.
const SILENT_WAV_DATA_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

export type VoiceChatResult = {
  transcript: string;
  text: string;
  audioBase64: string;
  // Prefer `mime` (per backend contract); `audioMime` kept for compatibility.
  mime: string;
  audioMime?: string;
};

export type UseVoiceChatOptions = {
  maxDurationMs?: number;
  silenceMs?: number;
  // Keep microphone stream alive across turns (enables barge-in / continuous mode UX).
  keepStreamAlive?: boolean;
  // If provided, called after audio playback finishes (or after a text-only turn completes).
  onSpeakingEnded?: () => void;
  // Called after backend pipeline finishes
  onResult?: (result: VoiceChatResult) => void;
  onError?: (message: string) => void;

  // Optional integration hooks (for premium visualizers / external analyzers)
  onInputStream?: (stream: MediaStream | null) => void;
  onOutputAudioElement?: (el: HTMLAudioElement | null) => void;
};

export type VoiceChatDebugInfo = {
  lastEvent: string;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastStopReason:
    | "manual"
    | "endOfSpeech"
    | "maxDuration"
    | "recorderError"
    | "streamEnded"
    | "unknown";
  recorderState: string;
  recorderMimeType: string;
  streamActive: boolean;
  trackStates: Array<{ kind: string; enabled: boolean; readyState: string }>;
  chunks: number;
  lastBlobBytes: number;
};

function pickMimeType(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const mr = (window as any).MediaRecorder as typeof MediaRecorder | undefined;
  if (!mr) return undefined;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const c of candidates) {
    try {
      if ((mr as any).isTypeSupported?.(c)) return c;
    } catch {
      // ignore
    }
  }

  return undefined;
}

export function useVoiceChat(options: UseVoiceChatOptions = {}) {
  const {
    maxDurationMs = 10000,
    silenceMs = 2500,
    keepStreamAlive = false,
    onSpeakingEnded,
    onResult,
    onError,
    onInputStream,
    onOutputAudioElement,
  } = options;

  // IMPORTANT: keep option callbacks stable across renders.
  // In React, inline callbacks passed from the UI change every render.
  // If internal callbacks depend on them, effect cleanups can run and stop recording.
  const onResultRef = useRef<typeof onResult>(onResult);
  const onErrorRef = useRef<typeof onError>(onError);
  const onSpeakingEndedRef = useRef<typeof onSpeakingEnded>(onSpeakingEnded);
  const onInputStreamRef = useRef<typeof onInputStream>(onInputStream);
  const onOutputAudioElementRef =
    useRef<typeof onOutputAudioElement>(onOutputAudioElement);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onSpeakingEndedRef.current = onSpeakingEnded;
  }, [onSpeakingEnded]);
  useEffect(() => {
    onInputStreamRef.current = onInputStream;
  }, [onInputStream]);
  useEffect(() => {
    onOutputAudioElementRef.current = onOutputAudioElement;
  }, [onOutputAudioElement]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speakingLevel, setSpeakingLevel] = useState(0);
  const [listeningLevel, setListeningLevel] = useState(0);

  const [debugInfo, setDebugInfo] = useState<VoiceChatDebugInfo>({
    lastEvent: "init",
    lastStartAt: null,
    lastStopAt: null,
    lastStopReason: "unknown",
    recorderState: "inactive",
    recorderMimeType: "",
    streamActive: false,
    trackStates: [],
    chunks: 0,
    lastBlobBytes: 0,
  });

  const stopReasonRef = useRef<VoiceChatDebugInfo["lastStopReason"]>("unknown");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const playbackUnlockedRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceActivityAtRef = useRef<number>(0);
  const heardSpeechThisTurnRef = useRef<boolean>(false);

  const sendOnStopRef = useRef(false);
  const sendParamsRef = useRef<{
    sessionId?: string;
    chatModel?: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearTimers = useCallback(() => {
    if (typeof window === "undefined") return;
    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const snapshotDebug = useCallback((event: string) => {
    const s = streamRef.current;
    const r = recorderRef.current;
    const tracks = s?.getTracks() ?? [];
    setDebugInfo((prev) => ({
      ...prev,
      lastEvent: event,
      recorderState: r?.state ?? "inactive",
      recorderMimeType: r?.mimeType ?? "",
      streamActive: Boolean(s?.active),
      trackStates: tracks.map((t) => ({
        kind: t.kind,
        enabled: (t as MediaStreamTrack).enabled,
        readyState: (t as MediaStreamTrack).readyState,
      })),
      chunks: chunksRef.current.length,
    }));
  }, []);

  const ensureOutputAudioElement = useCallback((): HTMLAudioElement | null => {
    if (typeof window === "undefined") return null;

    if (audioElRef.current) return audioElRef.current;

    const a = new Audio();
    (a as any).playsInline = true;
    audioElRef.current = a;

    // IMPORTANT: connect analyzer once. A media element can only be connected once per AudioContext.
    try {
      onOutputAudioElementRef.current?.(a);
    } catch {
      // ignore
    }

    return a;
  }, []);

  const primeSilentLoop = useCallback(async () => {
    const a = ensureOutputAudioElement();
    if (!a) return;

    // Clean up old object URL if any.
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {
        // ignore
      }
      audioUrlRef.current = null;
    }

    try {
      a.pause();
    } catch {
      // ignore
    }

    a.src = SILENT_WAV_DATA_URL;
    a.loop = true;
    a.muted = true;
    a.volume = 0;

    try {
      // Best-effort: if this is outside a gesture, it may be blocked.
      // That's OK — unlockPlayback will prime it under user interaction.
      await a.play();
    } catch {
      // ignore
    }
  }, [ensureOutputAudioElement]);

  const stopSpeaking = useCallback(() => {
    const a = audioElRef.current;
    if (a) {
      try {
        a.pause();
      } catch {
        // ignore
      }
      try {
        a.currentTime = 0;
      } catch {
        // ignore
      }
    }

    setSpeakingLevel(0);
    setIsSpeaking(false);
  }, []);

  const unlockPlayback = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (playbackUnlockedRef.current) return true;

    // Attempt to unlock audio playback under a user gesture.
    // 1) Resume an AudioContext (some browsers gate it)
    // 2) Play a tiny silent wav (unlocks HTMLAudioElement playback)
    try {
      const Ctx = (window.AudioContext ||
        (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (Ctx) {
        const ctx = new Ctx();
        try {
          if (ctx.state === "suspended") await ctx.resume();
        } catch {
          // ignore
        }
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    try {
      // Prime a persistent audio element under the user gesture.
      await primeSilentLoop();
      playbackUnlockedRef.current = true;
      return true;
    } catch (e) {
      console.warn("[voice] playback unlock failed", e);
      return false;
    }
  }, [primeSilentLoop]);

  const stopProcessing = useCallback(() => {
    const ac = abortRef.current;
    abortRef.current = null;
    try {
      ac?.abort();
    } catch {
      // ignore
    }
    setIsProcessing(false);
  }, []);

  const teardownAudioAnalysis = useCallback(async () => {
    if (typeof window === "undefined") return;

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    analyserRef.current = null;

    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
    }
  }, []);

  const stopTracks = useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    if (!s) return;
    for (const t of s.getTracks()) {
      try {
        t.stop();
      } catch {
        // ignore
      }
    }

    try {
      onInputStreamRef.current?.(null);
    } catch {
      // ignore
    }

    setDebugInfo((prev) => ({
      ...prev,
      streamActive: false,
      trackStates: [],
    }));
  }, []);

  const applyMuteToStream = useCallback((muted: boolean) => {
    const s = streamRef.current;
    if (!s) return;
    for (const t of s.getAudioTracks()) {
      try {
        t.enabled = !muted;
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      applyMuteToStream(next);
      return next;
    });
  }, [applyMuteToStream]);

  const stop = useCallback(() => {
    clearTimers();
    const r = recorderRef.current;

    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        // ignore
      }
    } else {
      setIsRecording(false);
    }
  }, [clearTimers]);

  const stopWithReason = useCallback(
    (reason: VoiceChatDebugInfo["lastStopReason"]) => {
      console.log("STOP TRIGGERED:", reason);
      stopReasonRef.current = reason;
      snapshotDebug(`stop:${reason}`);
      stop();
    },
    [snapshotDebug, stop],
  );

  const cancel = useCallback(() => {
    sendOnStopRef.current = false;
    sendParamsRef.current = null;
    stopProcessing();
    stopWithReason("manual");
    stopSpeaking();
    stopTracks();
  }, [stopProcessing, stopSpeaking, stopTracks, stopWithReason]);

  const playAudio = useCallback(
    async (result: VoiceChatResult): Promise<boolean> => {
      if (typeof window === "undefined") return false;

      stopSpeaking();

      const a = ensureOutputAudioElement();
      if (!a) {
        const msg = "Failed to initialize audio playback";
        setError(msg);
        onErrorRef.current?.(msg);
        return false;
      }

      // Clean up old object URL if any (avoid leaks and stale src).
      if (audioUrlRef.current) {
        try {
          URL.revokeObjectURL(audioUrlRef.current);
        } catch {
          // ignore
        }
        audioUrlRef.current = null;
      }

      const mime = "audio/mpeg";
      const dataUrl = `data:${mime};base64,${result.audioBase64}`;
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      console.log("AUDIO DEBUG:", {
        mime,
        base64Length: result.audioBase64?.length,
      });

      a.src = url;
      a.loop = false;
      a.muted = false;
      a.volume = 1;

      // IMPORTANT: do not use onerror to display failures.
      // Some browsers fire error events during src swaps even if playback succeeds.
      a.onerror = null;

      const didPlayRef = { value: false };

      const waitForEnd = () =>
        new Promise<void>((resolve) => {
          const finish = () => resolve();
          a.onended = finish;
          // If user interrupts, stopSpeaking() will pause the element.
          // We treat that as "ended" for the purpose of continuing the session.
          a.onpause = () => {
            // Only resolve if we actually started playing and then got paused.
            if (didPlayRef.value) resolve();
          };
        });

      try {
        setIsSpeaking(true);
        setSpeakingLevel(0);

        try {
          await a.play();
          didPlayRef.value = true;
        } catch (e) {
          console.warn("Audio play blocked (first try)", e);
          // Retry once (some browsers need a short delay after src assignment)
          try {
            await new Promise((r) => setTimeout(r, 80));
            await a.play();
            didPlayRef.value = true;
          } catch (e2) {
            console.warn("Audio play blocked (second try)", e2);
            setIsSpeaking(false);
            // Fallback to text-only: do not stop conversation.
            const msg = "Audio playback was blocked by the browser";
            setError(msg);
            onErrorRef.current?.(msg);
            void primeSilentLoop();
            return false;
          }
        }

        // Wait until playback actually ends (or is interrupted).
        await waitForEnd();

        setIsSpeaking(false);
        void primeSilentLoop();
        return true;
      } catch (e) {
        console.warn("Audio play failed", e);
        setIsSpeaking(false);
        // Only show an error if playback truly never started.
        if (!didPlayRef.value) {
          const msg = "Audio playback failed";
          setError(msg);
          onErrorRef.current?.(msg);
        }
        void primeSilentLoop();
        return false;
      }
    },

    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureOutputAudioElement, primeSilentLoop, stopSpeaking],
  );

  const sendBlob = useCallback(
    async (blob: Blob, params: { sessionId?: string; chatModel?: string }) => {
      if (typeof window === "undefined") return;

      if (blob.size < 1024) {
        const msg = "No speech detected";
        setError(msg);
        onErrorRef.current?.(msg);
        onSpeakingEndedRef.current?.();
        return;
      }

      setIsProcessing(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const form = new FormData();
        form.set("audio", blob, "voice.webm");
        if (params.sessionId) form.set("sessionId", params.sessionId);
        if (params.chatModel) form.set("chatModel", params.chatModel);
        form.set("sttModel", "whisper-large-v3-turbo");

        console.debug("[voice] sending audio", {
          bytes: blob.size,
          type: blob.type,
          sessionId: params.sessionId,
          chatModel: params.chatModel,
        });

        const res = await fetch("/api/voice-chat", {
          method: "POST",
          body: form,
          signal: controller.signal,
        });

        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          const msg = String(json?.error ?? res.statusText);
          setError(msg);
          onErrorRef.current?.(msg);
          onSpeakingEndedRef.current?.();
          return;
        }

        const t = String(json?.transcript ?? "").trim();
        const text = String(json?.text ?? "").trim();
        const audioBase64 = String(json?.audioBase64 ?? "");
        const mime = String(json?.mime ?? json?.audioMime ?? "audio/mpeg");

        const result: VoiceChatResult = {
          transcript: t,
          text,
          audioBase64,
          mime,
          audioMime: String(json?.audioMime ?? ""),
        };

        if (!result.transcript || !result.text) {
          const msg = "Voice chat returned an incomplete response";
          setError(msg);
          onErrorRef.current?.(msg);
          onSpeakingEndedRef.current?.();
          return;
        }

        setTranscript(result.transcript);
        setResponse(result.text);
        onResultRef.current?.(result);

        // Text-only fallback is allowed (e.g., TTS generation failed).
        if (result.audioBase64) {
          await playAudio(result);
          onSpeakingEndedRef.current?.();
        } else {
          onSpeakingEndedRef.current?.();
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          const msg = "Voice chat request was aborted";
          console.warn("[voice] aborted", e);
          setError(msg);
          onErrorRef.current?.(msg);
          // Do not auto-restart on abort; user likely pressed stop.
          return;
        }

        console.error("Voice chat failed", e);
        const msg = "Voice chat failed";
        setError(msg);
        onErrorRef.current?.(msg);
        onSpeakingEndedRef.current?.();
      } finally {
        abortRef.current = null;
        setIsProcessing(false);
      }
    },
    [playAudio],
  );

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (isProcessing) return;

    try {
      setError(null);
      stopSpeaking();

      // Safety: ensure no stale timers from a previous turn can stop us instantly.
      clearTimers();
      stopReasonRef.current = "unknown";
      setDebugInfo((prev) => ({
        ...prev,
        lastEvent: "start:begin",
        lastStartAt: Date.now(),
        lastStopAt: null,
        lastStopReason: "unknown",
        chunks: 0,
        lastBlobBytes: 0,
      }));

      const existing = streamRef.current;
      const canReuse =
        keepStreamAlive &&
        Boolean(existing?.active) &&
        (existing?.getAudioTracks?.() ?? []).some(
          (t) => t.readyState === "live",
        );

      const stream = canReuse
        ? existing!
        : await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = stream;

      // If a track ends immediately, capture it.
      for (const t of stream.getTracks()) {
        t.onended = () => {
          stopReasonRef.current = "streamEnded";
          snapshotDebug("track:onended");
        };
      }

      snapshotDebug("stream:acquired");

      try {
        onInputStreamRef.current?.(stream);
      } catch {
        // ignore
      }

      applyMuteToStream(isMuted);
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;

      snapshotDebug("recorder:created");

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        // keep lightweight debug up to date
        setDebugInfo((prev) => ({ ...prev, chunks: chunksRef.current.length }));
      };

      let started = false;
      const markStarted = () => {
        if (started) return;
        started = true;

        setIsRecording(true);
        lastVoiceActivityAtRef.current = Date.now();
        heardSpeechThisTurnRef.current = false;

        snapshotDebug("recorder:onstart");

        // CRITICAL FAILSAFE: always stop after maxDurationMs (no re-arming loops).
        maxTimerRef.current = window.setTimeout(() => {
          stopWithReason("maxDuration");
        }, maxDurationMs);

        // silence detect (simple amplitude monitor)
        try {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          // Some browsers start in "suspended".
          void ctx.resume().catch(() => {
            // ignore
          });
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          analyserRef.current = analyser;
          src.connect(analyser);

          const data = new Uint8Array(analyser.fftSize);

          // Lower + adaptive threshold: many mics sit around ~1-3.
          const baseThreshold = 2;
          let noiseFloor = 0; // EMA of background noise
          let smoothed = 0; // EMA smoothing for stability

          // Debug logging (throttled to avoid devtools spam)
          let logCounter = 0;
          const logEvery = 10;

          const tick = () => {
            const a = analyserRef.current;
            if (!a) return;

            a.getByteTimeDomainData(data);
            // compute mean absolute deviation from 128
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              sum += Math.abs(data[i] - 128);
            }
            const level = sum / data.length;

            // Log raw input level so we can tune threshold.
            if (logCounter++ % logEvery === 0) {
              console.log("LEVEL:", level);
            }

            // Smooth level + estimate noise floor before speech is detected.
            const alpha = 0.18;
            smoothed = smoothed ? smoothed + alpha * (level - smoothed) : level;
            if (!heardSpeechThisTurnRef.current) {
              const nfAlpha = 0.08;
              noiseFloor = noiseFloor
                ? noiseFloor + nfAlpha * (smoothed - noiseFloor)
                : smoothed;
            }

            const threshold = Math.max(baseThreshold, noiseFloor + 1.2);

            // Normalize loosely into 0..1 for UI waveform (best-effort)
            const norm = Math.max(0, Math.min(1, (smoothed - 2) / 20));
            setListeningLevel(norm);

            if (smoothed > threshold) {
              lastVoiceActivityAtRef.current = Date.now();
              heardSpeechThisTurnRef.current = true;
              if (silenceTimerRef.current) {
                window.clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            } else {
              // Only consider silence as end-of-utterance AFTER we have heard speech.
              if (heardSpeechThisTurnRef.current && !silenceTimerRef.current) {
                silenceTimerRef.current = window.setTimeout(() => {
                  stopWithReason("endOfSpeech");
                }, silenceMs);
              }
            }

            rafRef.current = window.requestAnimationFrame(tick);
          };

          rafRef.current = window.requestAnimationFrame(tick);
        } catch {
          // If AudioContext fails (autoplay policy etc), still record with maxDuration.
        }
      };

      recorder.onstart = markStarted;

      recorder.onstop = async () => {
        const stopAt = Date.now();
        const stopReason = stopReasonRef.current;

        try {
          await teardownAudioAnalysis();
        } catch {
          // ignore
        } finally {
          clearTimers();
          setIsRecording(false);
          setListeningLevel(0);
          const shouldStopStream =
            !keepStreamAlive ||
            stopReason === "manual" ||
            stopReason === "recorderError" ||
            stopReason === "streamEnded";
          if (shouldStopStream) {
            stopTracks();
          } else {
            // Keep stream alive for continuous session / barge-in.
            snapshotDebug("stream:kept");
          }
        }

        snapshotDebug("recorder:onstop");

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        setDebugInfo((prev) => ({
          ...prev,
          lastStopAt: stopAt,
          lastStopReason: stopReason,
          lastBlobBytes: blob.size,
        }));

        // If `cancel()` was used, do nothing further.
        if (!sendOnStopRef.current || !sendParamsRef.current) {
          console.debug("[voice] recording stopped (no send)");
          return;
        }

        const params = sendParamsRef.current;
        sendOnStopRef.current = false;
        sendParamsRef.current = null;

        await sendBlob(blob, params);
      };

      recorder.onerror = () => {
        const msg = "Microphone recording error";
        setError(msg);
        onErrorRef.current?.(msg);
        stopReasonRef.current = "recorderError";
        snapshotDebug("recorder:onerror");
        sendOnStopRef.current = false;
        sendParamsRef.current = null;
        stopTracks();
        setIsRecording(false);
        setListeningLevel(0);
      };

      // Some browsers/drivers can throw on timeslice.
      try {
        recorder.start(250);
        markStarted();
      } catch {
        try {
          recorder.start();
          markStarted();
        } catch (e) {
          console.error("Failed to start MediaRecorder", e);
          const msg = "Failed to start recording";
          setError(msg);
          onErrorRef.current?.(msg);
          snapshotDebug("recorder:start:failed");
          sendOnStopRef.current = false;
          sendParamsRef.current = null;
          stopTracks();
          setIsRecording(false);
          setListeningLevel(0);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to start recording", e);
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Failed to access microphone";
      setError(msg);
      onErrorRef.current?.(msg);
      snapshotDebug("getUserMedia:failed");
      sendOnStopRef.current = false;
      sendParamsRef.current = null;
      stopTracks();
      setIsRecording(false);
      setListeningLevel(0);
    }
  }, [
    isProcessing,
    maxDurationMs,
    silenceMs,
    stopWithReason,
    stopSpeaking,
    stopTracks,
    teardownAudioAnalysis,
    clearTimers,
    applyMuteToStream,
    isMuted,
    keepStreamAlive,
    sendBlob,
    snapshotDebug,
  ]);

  const beginTurn = useCallback(
    async (params: { sessionId?: string; chatModel?: string }) => {
      if (isProcessing) return;
      if (isRecording) return;

      // Clear last turn (debug panel shows latest values; this keeps it consistent).
      setTranscript("");
      setResponse("");
      setError(null);

      sendParamsRef.current = params;
      sendOnStopRef.current = true;
      await start();
    },
    [isProcessing, isRecording, start],
  );

  const stopListening = useCallback(() => {
    stopWithReason("manual");
  }, [stopWithReason]);

  const toggle = useCallback(
    async (params: { sessionId?: string; chatModel?: string }) => {
      if (isProcessing) return;
      if (isSpeaking) {
        stopSpeaking();
        return;
      }

      if (isRecording) {
        // legacy: stop + auto-send
        sendParamsRef.current = params;
        sendOnStopRef.current = true;
        stop();
      } else {
        await beginTurn(params);
      }
    },
    [isProcessing, isSpeaking, isRecording, beginTurn, stop, stopSpeaking],
  );

  useEffect(() => {
    return () => {
      snapshotDebug("cleanup:unmount");
      clearTimers();
      cancel();
      teardownAudioAnalysis();
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      recorderRef.current = null;
      stopTracks();
    };
  }, [cancel, clearTimers, snapshotDebug, stopTracks, teardownAudioAnalysis]);

  return {
    // Required state names (aliases)
    isListening: isRecording,
    isProcessing,
    isSpeaking,
    transcript,
    response,
    error,
    speakingLevel,
    listeningLevel,
    isMuted,
    toggleMute,

    // Autoplay policy helper (must be called from a user gesture)
    unlockPlayback,

    // Primary modal-friendly API
    beginTurn,
    stopListening,
    cancel,
    stopProcessing,

    // Back-compat API (used by existing UI in a few places)
    isRecording,
    start,
    stop,
    toggle,
    stopSpeaking,

    debugInfo,
  };
}
