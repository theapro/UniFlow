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

function mixColor(mode: VoiceVizMode) {
  if (mode === "speaking") return { r: 245, g: 245, b: 245 };
  if (mode === "processing") return { r: 220, g: 220, b: 220 };
  return { r: 200, g: 200, b: 200 };
}

export function RingSphere(props: {
  mode: VoiceVizMode;
  levelRef: React.MutableRefObject<number>;
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, levelRef, frequencyDataRef, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const bars = useMemo(() => {
    const count = 96;
    return Array.from({ length: count }, (_, i) => ({
      a: (i / count) * Math.PI * 2,
    }));
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

      const baseR = Math.min(w, h) * 0.24;
      const ringR = baseR * (1 + 0.04 * Math.sin(time * 1.1));

      ctx.clearRect(0, 0, w, h);

      // Soft core glow
      const core = ctx.createRadialGradient(
        cx,
        cy,
        ringR * 0.2,
        cx,
        cy,
        ringR * 2.4,
      );
      core.addColorStop(0, `rgba(${cr},${cg},${cb},0.10)`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, w, h);

      // Outer ring
      ctx.save();
      ctx.translate(cx, cy);

      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + 0.06 * smoothLevel})`;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();

      const smoothBars = smoothBarsRef.current;

      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${mode === "speaking" ? 0.35 : 0.22})`;
      ctx.shadowBlur = mode === "speaking" ? 18 + 22 * smoothLevel : 12;

      for (let i = 0; i < bars.length; i++) {
        const a = bars[i].a;

        let amp = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((i / bars.length) * freq.length),
          );
          amp = freq[bin] / 255;
        }

        const targetBar =
          (mode === "processing" ? 0.18 : 0.1) +
          (mode === "speaking" ? 0.7 * amp : 0.35 * amp) +
          0.12 * smoothLevel;

        const prev = smoothBars ? smoothBars[i] : 0;
        const next = lerp(prev, targetBar, 0.22);
        if (smoothBars) smoothBars[i] = next;

        const barLen = Math.min(ringR * 1.2, ringR * (0.25 + next));
        const inner = ringR * 0.88;
        const outer = inner + barLen;

        const x1 = Math.cos(a) * inner;
        const y1 = Math.sin(a) * inner;
        const x2 = Math.cos(a) * outer;
        const y2 = Math.sin(a) * outer;

        const alpha = 0.08 + 0.22 * next;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Tip highlight
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + 0.08 * next})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 + Math.cos(a) * 6, y2 + Math.sin(a) * 6);
        ctx.stroke();
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
  }, [bars, frequencyDataRef, levelRef, mode]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative aspect-square w-[340px] max-w-[75vw]",
        "[mask-image:radial-gradient(circle_at_center,black_62%,transparent_100%)]",
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
