"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { VoiceVizMode } from "@/components/voice/ParticleSphere";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function WaveformSphere(props: {
  mode: VoiceVizMode;
  levelRef: React.MutableRefObject<number>;
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, levelRef, frequencyDataRef, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const bars = useMemo(() => {
    const count = 56;
    return Array.from({ length: count }, (_, i) => ({ i }));
  }, []);

  const smoothBarsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    smoothBarsRef.current = new Float32Array(bars.length);
  }, [bars.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let mounted = true;

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrapper);

    let smoothLevel = 0;

    const draw = (t: number) => {
      if (!mounted) return;

      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const time = t * 0.001;

      const freq = frequencyDataRef?.current ?? null;
      const level = clamp01(levelRef.current);
      smoothLevel = lerp(smoothLevel, level, 0.08);

      const sm = smoothBarsRef.current;

      ctx.clearRect(0, 0, w, h);

      // Minimal soft vignette
      const vignette = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.min(w, h) * 0.55,
      );
      vignette.addColorStop(0, "rgba(255,255,255,0.04)");
      vignette.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(0, 0);

      // Baseline
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.18, cy);
      ctx.lineTo(w * 0.82, cy);
      ctx.stroke();

      const left = w * 0.18;
      const right = w * 0.82;
      const usable = right - left;
      const gap = usable / (bars.length + 1);

      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "rgba(255,255,255,0.18)";
      ctx.shadowBlur = mode === "speaking" ? 18 + 22 * smoothLevel : 12;

      for (let i = 0; i < bars.length; i++) {
        const x = left + (i + 1) * gap;

        let amp = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((i / bars.length) * freq.length),
          );
          amp = freq[bin] / 255;
        }

        // Keep it minimal: bars are mostly calm, spike only when speaking.
        const base = mode === "processing" ? 0.06 : 0.04;
        const target =
          base +
          (mode === "speaking" ? 0.55 * amp : 0.25 * amp) +
          0.1 * smoothLevel;

        const prev = sm ? sm[i] : 0;
        const next = lerp(prev, target, 0.18);
        if (sm) sm[i] = next;

        const len = Math.min(h * 0.32, h * (0.08 + next));

        ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.22 * next})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, cy - len);
        ctx.lineTo(x, cy + len);
        ctx.stroke();

        // Small tip shimmer
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + 0.1 * next})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, cy - len - 6);
        ctx.lineTo(x, cy - len);
        ctx.stroke();
      }

      // Idle breathing micro-noise (keeps it alive)
      if (mode === "idle") {
        ctx.globalCompositeOperation = "screen";
        const k = 0.03 + 0.02 * Math.sin(time * 1.2);
        ctx.fillStyle = `rgba(255,255,255,${k})`;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(w, h) * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      mounted = false;
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [bars.length, frequencyDataRef, levelRef, mode]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative aspect-square w-[340px] max-w-[75vw]",
        "[mask-image:radial-gradient(circle_at_center,black_66%,transparent_100%)]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
