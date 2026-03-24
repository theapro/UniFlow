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

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function grad(hash: number, x: number) {
  // 1D gradient: either x or -x
  return (hash & 1) === 0 ? x : -x;
}

function hash1(n: number) {
  // Deterministic integer hash
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
  return (x ^ (x >>> 14)) >>> 0;
}

function perlin1d(x: number) {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = x - x0;

  const h0 = hash1(x0);
  const h1 = hash1(x1);

  const g0 = grad(h0, t);
  const g1 = grad(h1, t - 1);

  const u = fade(t);
  return lerp(g0, g1, u); // ~[-1,1]
}

function mixColor(mode: VoiceVizMode) {
  if (mode === "speaking") return { r: 167, g: 139, b: 250 }; // violet-400
  if (mode === "processing") return { r: 59, g: 130, b: 246 }; // blue-500
  return { r: 34, g: 211, b: 238 }; // cyan-400
}

export function WaveSphere(props: {
  mode: VoiceVizMode;
  levelRef: React.MutableRefObject<number>;
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, levelRef, frequencyDataRef, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const angles = useMemo(() => {
    const count = 320;
    return Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let mounted = true;
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
      const target = clamp01(levelRef.current);
      smoothLevel = lerp(smoothLevel, target, 0.08);

      const freq = frequencyDataRef?.current ?? null;
      const { r: cr, g: cg, b: cb } = mixColor(mode);

      const baseRadius = Math.min(w, h) * 0.285;

      const breathe = 1 + 0.045 * Math.sin(time * 0.95);
      const speak =
        1 + (mode === "speaking" ? 0.13 * smoothLevel : 0.05 * smoothLevel);
      const r0 = baseRadius * breathe * speak;

      ctx.clearRect(0, 0, w, h);

      // Glassy haze behind the blob
      const haze = ctx.createRadialGradient(cx, cy, r0 * 0.3, cx, cy, r0 * 2.4);
      haze.addColorStop(0, `rgba(${cr},${cg},${cb},0.10)`);
      haze.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);

      const distortionBase = mode === "processing" ? 10 : 7;
      const distortionAudio =
        mode === "speaking" ? 28 * smoothLevel : 12 * smoothLevel;
      const distortion = distortionBase + distortionAudio;

      // Outer glow
      ctx.shadowBlur = mode === "speaking" ? 46 + 70 * smoothLevel : 32;
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${mode === "speaking" ? 0.55 : 0.35})`;

      ctx.beginPath();
      for (let i = 0; i <= angles.length; i++) {
        const idx = i % angles.length;
        const a = angles[idx];

        const n1 = perlin1d(a * 1.1 + time * 0.9);
        const n2 = perlin1d(a * 2.2 - time * 0.65);
        const n3 = Math.sin(a * 3 + time * 1.4);
        const noise = (n1 * 0.65 + n2 * 0.45 + n3 * 0.22) / 1.25;

        let f = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((idx / angles.length) * freq.length),
          );
          f = (freq[bin] / 255) * 2 - 1;
        }

        const rr =
          r0 +
          noise * distortion +
          f * (mode === "speaking" ? 18 * smoothLevel : 8 * smoothLevel);

        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Premium fill
      const fill = ctx.createRadialGradient(
        -r0 * 0.2,
        -r0 * 0.2,
        0,
        0,
        0,
        r0 * 1.35,
      );
      fill.addColorStop(0, `rgba(255,255,255,${0.16 + 0.1 * smoothLevel})`);
      fill.addColorStop(0.35, `rgba(${cr},${cg},${cb},${0.78})`);
      fill.addColorStop(1, "rgba(2,6,23,0.25)");
      ctx.fillStyle = fill;
      ctx.fill();

      // Inner sheen
      ctx.globalCompositeOperation = "screen";
      const sheen = ctx.createRadialGradient(
        -r0 * 0.35,
        -r0 * 0.35,
        0,
        -r0 * 0.35,
        -r0 * 0.35,
        r0 * 1.4,
      );
      sheen.addColorStop(
        0,
        `rgba(255,255,255,${mode === "speaking" ? 0.25 : 0.17})`,
      );
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.beginPath();
      ctx.arc(-r0 * 0.15, -r0 * 0.15, r0 * 1.05, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";

      // Subtle edge line
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + 0.06 * smoothLevel})`;
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
  }, [angles, frequencyDataRef, levelRef, mode]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative aspect-square w-[340px] max-w-[75vw]",
        "[mask-image:radial-gradient(circle_at_center,black_64%,transparent_100%)]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
