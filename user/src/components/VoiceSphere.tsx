"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type Mode = "idle" | "processing" | "speaking";

export function VoiceSphere(props: {
  mode: Mode;
  level: number; // 0..1
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, level, frequencyDataRef, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const points = useMemo(() => {
    const count = 140;
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return { a };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let mounted = true;

    // internal smoothing so sphere never jitters
    let smoothLevel = 0;

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

    const draw = (t: number) => {
      if (!mounted) return;

      const w = wrapper.clientWidth;
      const h = wrapper.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      const time = t * 0.001;
      const target = Math.max(0, Math.min(1, level));
      smoothLevel = smoothLevel + (target - smoothLevel) * 0.1;

      const baseRadius = Math.min(w, h) * 0.28;

      const breathe = 1 + 0.035 * Math.sin(time * 1.2);
      const processingPulse = 1 + 0.02 * Math.sin(time * 3.2);

      const speakingBoost = 1 + smoothLevel * 0.15;
      const radiusScale =
        mode === "speaking"
          ? breathe * speakingBoost
          : mode === "processing"
            ? breathe * processingPulse
            : breathe;

      const r = baseRadius * radiusScale;

      ctx.clearRect(0, 0, w, h);

      // Background vignette (subtle)
      const bg = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
      bg.addColorStop(0, "rgba(255,255,255,0.02)");
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Build organic outline
      const freq = frequencyDataRef?.current ?? null;
      const count = points.length;

      const wobbleBase = mode === "processing" ? 5 : 3;
      const wobbleAudio =
        mode === "speaking" ? 14 * smoothLevel : 4 * smoothLevel;

      const wobble = wobbleBase + wobbleAudio;

      ctx.save();
      ctx.translate(cx, cy);

      // Glow
      ctx.shadowBlur =
        mode === "speaking"
          ? 40 + 60 * smoothLevel
          : mode === "processing"
            ? 26
            : 22;
      ctx.shadowColor =
        mode === "speaking" ? "rgba(99,102,241,0.55)" : "rgba(59,130,246,0.35)";

      ctx.beginPath();
      for (let i = 0; i <= count; i++) {
        const idx = i % count;
        const a = points[idx].a;

        const n1 = Math.sin(a * 3 + time * 1.4);
        const n2 = Math.cos(a * 5 - time * 1.1);
        const n3 = Math.sin(a * 2 + time * 0.7);
        let noise = (n1 + n2 * 0.8 + n3 * 0.6) / 2.4;

        let f = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((idx / count) * freq.length),
          );
          f = (freq[bin] / 255) * 2 - 1;
        }

        const distortion =
          noise * wobble +
          f * (mode === "speaking" ? 10 * smoothLevel : 3 * smoothLevel);
        const rr = r + distortion;

        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const fill = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.2);
      // Premium blue/violet core
      fill.addColorStop(0, "rgba(167,139,250,0.95)");
      fill.addColorStop(0.45, "rgba(59,130,246,0.75)");
      fill.addColorStop(1, "rgba(30,41,59,0.15)");

      ctx.fillStyle = fill;
      ctx.fill();

      // Inner highlight
      const hl = ctx.createRadialGradient(
        -r * 0.25,
        -r * 0.25,
        0,
        -r * 0.25,
        -r * 0.25,
        r * 1.2,
      );
      hl.addColorStop(
        0,
        mode === "speaking"
          ? "rgba(255,255,255,0.22)"
          : "rgba(255,255,255,0.14)",
      );
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.2, r * 0.95, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";

      // Edge line (very subtle)
      ctx.lineWidth = 1;
      ctx.strokeStyle =
        mode === "speaking"
          ? "rgba(255,255,255,0.14)"
          : "rgba(255,255,255,0.08)";
      ctx.stroke();

      ctx.restore();

      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);

    return () => {
      mounted = false;
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [frequencyDataRef, level, mode, points]);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative aspect-square w-[280px] max-w-[70vw]", className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
