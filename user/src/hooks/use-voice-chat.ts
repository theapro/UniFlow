"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  // Called after backend pipeline finishes
  onResult?: (result: VoiceChatResult) => void;
  onError?: (message: string) => void;
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
    onResult,
    onError,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speakingLevel, setSpeakingLevel] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const maxTimerRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputRafRef = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVoiceActivityAtRef = useRef<number>(0);

  const sendOnStopRef = useRef(false);
  const sendParamsRef = useRef<{
    sessionId: string;
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

  const stopSpeaking = useCallback(() => {
    const a = audioElRef.current;
    if (a) {
      try {
        a.pause();
        a.src = "";
      } catch {
        // ignore
      }
    }
    audioElRef.current = null;

    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {
        // ignore
      }
      audioUrlRef.current = null;
    }

    if (typeof window !== "undefined" && outputRafRef.current) {
      window.cancelAnimationFrame(outputRafRef.current);
      outputRafRef.current = null;
    }

    const ctx = outputAudioContextRef.current;
    outputAudioContextRef.current = null;
    if (ctx) {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }

    setSpeakingLevel(0);
    setIsSpeaking(false);
  }, []);

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
  }, []);

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

  const cancel = useCallback(() => {
    sendOnStopRef.current = false;
    sendParamsRef.current = null;
    stopProcessing();
    stop();
    stopSpeaking();
    stopTracks();
  }, [stop, stopProcessing, stopSpeaking, stopTracks]);

  const playAudio = useCallback(
    async (result: VoiceChatResult) => {
      if (typeof window === "undefined") return;

      stopSpeaking();

      const mime = result.mime || result.audioMime || "audio/mpeg";
      const dataUrl = `data:${mime};base64,${result.audioBase64}`;
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const a = new Audio(url);
      audioElRef.current = a;

      a.onended = () => {
        stopSpeaking();
        setIsSpeaking(false);
      };
      a.onerror = () => {
        setIsSpeaking(false);
        const msg = "Failed to play audio";
        setError(msg);
        onError?.(msg);
      };

      try {
        setIsSpeaking(true);
        setSpeakingLevel(0);

        // Try to measure output level for sphere syncing (best-effort).
        try {
          const ctx = new AudioContext();
          outputAudioContextRef.current = ctx;
          const srcNode = ctx.createMediaElementSource(a);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          srcNode.connect(analyser);
          analyser.connect(ctx.destination);

          const data = new Uint8Array(analyser.fftSize);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++)
              sum += Math.abs(data[i] - 128);
            const level = sum / data.length;
            // normalize loosely into 0..1
            const norm = Math.max(0, Math.min(1, (level - 2) / 20));
            setSpeakingLevel(norm);
            outputRafRef.current = window.requestAnimationFrame(tick);
          };
          outputRafRef.current = window.requestAnimationFrame(tick);
        } catch {
          // ignore; audio still plays
        }

        await a.play();
      } catch (e) {
        console.warn("Audio play blocked", e);
        setIsSpeaking(false);
        const msg = "Audio playback was blocked by the browser";
        setError(msg);
        onError?.(msg);
      }
    },
    [onError, stopSpeaking],
  );

  const sendBlob = useCallback(
    async (blob: Blob, params: { sessionId: string; chatModel?: string }) => {
      if (typeof window === "undefined") return;

      if (blob.size < 1024) {
        const msg = "No speech detected";
        setError(msg);
        onError?.(msg);
        return;
      }

      setIsProcessing(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const form = new FormData();
        form.set("audio", blob, "voice.webm");
        form.set("sessionId", params.sessionId);
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
          onError?.(msg);
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

        if (!result.transcript || !result.text || !result.audioBase64) {
          const msg = "Voice chat returned an incomplete response";
          setError(msg);
          onError?.(msg);
          return;
        }

        setTranscript(result.transcript);
        setResponse(result.text);
        onResult?.(result);
        await playAudio(result);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          const msg = "Voice chat request was aborted";
          console.warn("[voice] aborted", e);
          setError(msg);
          onError?.(msg);
          return;
        }

        console.error("Voice chat failed", e);
        const msg = "Voice chat failed";
        setError(msg);
        onError?.(msg);
      } finally {
        abortRef.current = null;
        setIsProcessing(false);
      }
    },
    [onError, onResult, playAudio],
  );

  const start = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (isProcessing) return;

    try {
      setError(null);
      stopSpeaking();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        setIsRecording(true);
        lastVoiceActivityAtRef.current = Date.now();

        // hard stop
        maxTimerRef.current = window.setTimeout(() => stop(), maxDurationMs);

        // silence detect (simple amplitude monitor)
        try {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          analyserRef.current = analyser;
          src.connect(analyser);

          const data = new Uint8Array(analyser.fftSize);
          const threshold = 6; // minimal sensitivity

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

            if (level > threshold) {
              lastVoiceActivityAtRef.current = Date.now();
              if (silenceTimerRef.current) {
                window.clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            } else {
              if (!silenceTimerRef.current) {
                silenceTimerRef.current = window.setTimeout(() => {
                  stop();
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

      recorder.onstop = async () => {
        try {
          await teardownAudioAnalysis();
        } catch {
          // ignore
        } finally {
          clearTimers();
          setIsRecording(false);
          stopTracks();
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

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
        onError?.(msg);
        sendOnStopRef.current = false;
        sendParamsRef.current = null;
        stopTracks();
        setIsRecording(false);
      };

      recorder.start(250);
    } catch (e) {
      console.error("Failed to start recording", e);
      const msg = "Microphone permission denied";
      setError(msg);
      onError?.(msg);
      sendOnStopRef.current = false;
      sendParamsRef.current = null;
      stopTracks();
      setIsRecording(false);
    }
  }, [
    isProcessing,
    maxDurationMs,
    onError,
    silenceMs,
    stop,
    stopSpeaking,
    stopTracks,
    teardownAudioAnalysis,
    clearTimers,
    sendBlob,
  ]);

  const beginTurn = useCallback(
    async (params: { sessionId: string; chatModel?: string }) => {
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
    stop();
  }, [stop]);

  const toggle = useCallback(
    async (params: { sessionId: string; chatModel?: string }) => {
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
  }, [cancel, clearTimers, stopTracks, teardownAudioAnalysis]);

  return {
    // Required state names (aliases)
    isListening: isRecording,
    isProcessing,
    isSpeaking,
    transcript,
    response,
    error,
    speakingLevel,

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
  };
}
