"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AudioAnalyzerSnapshot = {
  inputConnected: boolean;
  outputConnected: boolean;
  inputLevel: number; // 0..1 (smoothed)
  outputLevel: number; // 0..1 (smoothed)
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function computeTimeDomainLevel(data: Uint8Array): number {
  // Mean absolute deviation from 128 -> loosely normalized into 0..1
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - 128);
  const mad = sum / data.length;
  return clamp01((mad - 2) / 20);
}

export function useAudioAnalyzer(options?: {
  fftSize?: number;
  smoothingTimeConstant?: number;
}) {
  const fftSize = options?.fftSize ?? 1024;
  const smoothingTimeConstant = options?.smoothingTimeConstant ?? 0.85;

  const [snapshot, setSnapshot] = useState<AudioAnalyzerSnapshot>({
    inputConnected: false,
    outputConnected: false,
    inputLevel: 0,
    outputLevel: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);

  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);

  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const inputFrequencyDataRef = useRef<Uint8Array | null>(null);
  const outputFrequencyDataRef = useRef<Uint8Array | null>(null);

  const inputTimeDataRef = useRef<Uint8Array | null>(null);
  const outputTimeDataRef = useRef<Uint8Array | null>(null);

  const inputLevelRef = useRef(0);
  const outputLevelRef = useRef(0);

  const outputConnectedToDestinationRef = useRef(false);

  const rafRef = useRef<number | null>(null);
  const lastSnapshotAtRef = useRef<number>(0);

  const ensureContext = useCallback(async () => {
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

    if (!inputAnalyserRef.current) {
      const a = ctx.createAnalyser();
      a.fftSize = fftSize;
      a.smoothingTimeConstant = smoothingTimeConstant;
      inputAnalyserRef.current = a;

      inputFrequencyDataRef.current = new Uint8Array(a.frequencyBinCount);
      inputTimeDataRef.current = new Uint8Array(a.fftSize);
    }

    if (!outputAnalyserRef.current) {
      const a = ctx.createAnalyser();
      a.fftSize = fftSize;
      a.smoothingTimeConstant = smoothingTimeConstant;
      outputAnalyserRef.current = a;

      outputFrequencyDataRef.current = new Uint8Array(a.frequencyBinCount);
      outputTimeDataRef.current = new Uint8Array(a.fftSize);
    }

    if (outputAnalyserRef.current && !outputConnectedToDestinationRef.current) {
      try {
        outputAnalyserRef.current.connect(ctx.destination);
        outputConnectedToDestinationRef.current = true;
      } catch {
        // ignore
      }
    }

    return ctx;
  }, [fftSize, smoothingTimeConstant]);

  const disconnectInput = useCallback(() => {
    const src = inputSourceRef.current;
    inputSourceRef.current = null;
    if (src) {
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }

    inputLevelRef.current = 0;
    setSnapshot((prev) => ({ ...prev, inputConnected: false, inputLevel: 0 }));
  }, []);

  const disconnectOutput = useCallback(() => {
    const src = outputSourceRef.current;
    outputSourceRef.current = null;
    if (src) {
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }

    outputLevelRef.current = 0;
    setSnapshot((prev) => ({
      ...prev,
      outputConnected: false,
      outputLevel: 0,
    }));
  }, []);

  const setInputStream = useCallback(
    async (stream: MediaStream | null) => {
      if (!stream) {
        disconnectInput();
        return;
      }

      const ctx = await ensureContext();
      if (!ctx) return;

      disconnectInput();

      const analyser = inputAnalyserRef.current;
      if (!analyser) return;

      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      inputSourceRef.current = src;

      setSnapshot((prev) => ({ ...prev, inputConnected: true }));
    },
    [disconnectInput, ensureContext],
  );

  const setOutputElement = useCallback(
    async (el: HTMLAudioElement | null) => {
      if (!el) {
        disconnectOutput();
        return;
      }

      const ctx = await ensureContext();
      if (!ctx) return;

      disconnectOutput();

      const analyser = outputAnalyserRef.current;
      if (!analyser) return;

      // Note: a single HTMLMediaElement can only be connected once per AudioContext.
      const src = ctx.createMediaElementSource(el);
      src.connect(analyser);
      outputSourceRef.current = src;

      setSnapshot((prev) => ({ ...prev, outputConnected: true }));
    },
    [disconnectOutput, ensureContext],
  );

  const tick = useCallback((t: number) => {
    const inputAnalyser = inputAnalyserRef.current;
    const outputAnalyser = outputAnalyserRef.current;

    const inFreq = inputFrequencyDataRef.current;
    const outFreq = outputFrequencyDataRef.current;
    const inTime = inputTimeDataRef.current;
    const outTime = outputTimeDataRef.current;

    if (inputAnalyser && inFreq && inTime && inputSourceRef.current) {
  inputAnalyser.getByteFrequencyData(inFreq as any); // 'as any' qo'shildi
  inputAnalyser.getByteTimeDomainData(inTime as any);

  const target = computeTimeDomainLevel(inTime);
  inputLevelRef.current = lerp(inputLevelRef.current, target, 0.12);
}

 if (outputAnalyser && outFreq && outTime && outputSourceRef.current) {
  outputAnalyser.getByteFrequencyData(outFreq as any); // 'as any' qo'shildi
  outputAnalyser.getByteTimeDomainData(outTime as any);

  const target = computeTimeDomainLevel(outTime);
  outputLevelRef.current = lerp(outputLevelRef.current, target, 0.12);
}

    // Throttle React state updates to keep render cost low.
    const now = t;
    if (now - lastSnapshotAtRef.current > 100) {
      lastSnapshotAtRef.current = now;
      setSnapshot((prev) => ({
        ...prev,
        inputLevel: inputLevelRef.current,
        outputLevel: outputLevelRef.current,
      }));
    }

    rafRef.current = window.requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    await ensureContext();

    if (typeof window === "undefined") return;
    if (rafRef.current) return;

    rafRef.current = window.requestAnimationFrame(tick);
  }, [ensureContext, tick]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    disconnectInput();
    disconnectOutput();
  }, [disconnectInput, disconnectOutput]);

  useEffect(() => {
    return () => {
      stop();

      inputAnalyserRef.current = null;
      outputAnalyserRef.current = null;
      inputFrequencyDataRef.current = null;
      outputFrequencyDataRef.current = null;
      inputTimeDataRef.current = null;
      outputTimeDataRef.current = null;

      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      outputConnectedToDestinationRef.current = false;
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
      snapshot,

      // Live refs for animation loops (avoid React rerenders)
      inputFrequencyDataRef,
      outputFrequencyDataRef,
      inputLevelRef,
      outputLevelRef,

      start,
      stop,
      setInputStream,
      setOutputElement,
      ensureContext,
    }),
    [ensureContext, setInputStream, setOutputElement, snapshot, start, stop],
  );

  return api;
}
