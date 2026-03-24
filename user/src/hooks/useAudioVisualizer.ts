"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StartFromBase64Params = {
  audioBase64: string;
  mime?: string;
  audible?: boolean;
};

type StartFromUrlParams = {
  url: string;
  audible?: boolean;
};

type VisualizerFrame = {
  level: number; // 0..1 (smoothed)
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleaned = base64.replace(/^data:.*?;base64,/, "").trim();
  const binaryString = atob(cleaned);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function useAudioVisualizer(options?: { fftSize?: number }) {
  const fftSize = options?.fftSize ?? 1024;

  const [frame, setFrame] = useState<VisualizerFrame>({ level: 0 });
  const [isActive, setIsActive] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothedLevelRef = useRef(0);

  const ensureGraph = useCallback(async () => {
    if (typeof window === "undefined") return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;

      frequencyDataRef.current = new Uint8Array(
        analyser.frequencyBinCount,
      ) as unknown as Uint8Array<ArrayBuffer>;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gainRef.current = gain;

      analyser.connect(gain);
      gain.connect(ctx.destination);
    }

    return {
      ctx,
      analyser: analyserRef.current,
      gain: gainRef.current,
    };
  }, [fftSize]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const src = sourceRef.current;
    sourceRef.current = null;
    if (src) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // ignore
      }
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }

    setIsActive(false);
    smoothedLevelRef.current = 0;
    setFrame({ level: 0 });
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const freq = frequencyDataRef.current;

    if (!analyser || !freq) return;

    analyser.getByteFrequencyData(freq);

    // Average magnitude -> 0..1
    let sum = 0;
    for (let i = 0; i < freq.length; i++) sum += freq[i];
    const avg = sum / (freq.length * 255);

    const next = clamp01(avg);
    const smoothed = lerp(smoothedLevelRef.current, next, 0.08);
    smoothedLevelRef.current = smoothed;

    setFrame({ level: smoothed });

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const startFromArrayBuffer = useCallback(
    async (arrayBuffer: ArrayBuffer, audible: boolean) => {
      const graph = await ensureGraph();
      if (!graph) return;

      stop();

      // decodeAudioData may detach the buffer; pass a copy.
      const decoded = await graph.ctx.decodeAudioData(arrayBuffer.slice(0));

      const src = graph.ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(graph.analyser);

      // Make it optionally audible (default: silent for no double-audio in main window)
      if (graph.gain) graph.gain.gain.value = audible ? 1 : 0;

      src.onended = () => {
        setIsActive(false);
      };

      sourceRef.current = src;
      setIsActive(true);

      try {
        src.start(0);
      } catch {
        setIsActive(false);
        return;
      }

      rafRef.current = window.requestAnimationFrame(tick);
    },
    [ensureGraph, stop, tick],
  );

  const startFromBase64 = useCallback(
    async (params: StartFromBase64Params) => {
      const arrayBuffer = base64ToArrayBuffer(params.audioBase64);
      await startFromArrayBuffer(arrayBuffer, Boolean(params.audible));
    },
    [startFromArrayBuffer],
  );

  const startFromUrl = useCallback(
    async (params: StartFromUrlParams) => {
      const res = await fetch(params.url);
      const arrayBuffer = await res.arrayBuffer();
      await startFromArrayBuffer(arrayBuffer, Boolean(params.audible));
    },
    [startFromArrayBuffer],
  );

  useEffect(() => {
    return () => {
      stop();
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      analyserRef.current = null;
      gainRef.current = null;
      frequencyDataRef.current = null;

      if (ctx) {
        try {
          ctx.close();
        } catch {
          // ignore
        }
      }
    };
  }, [stop]);

  const api = useMemo(
    () => ({
      frame,
      isActive,
      frequencyDataRef,
      startFromBase64,
      startFromUrl,
      stop,
    }),
    [frame, isActive, startFromBase64, startFromUrl, stop],
  );

  return api;
}
