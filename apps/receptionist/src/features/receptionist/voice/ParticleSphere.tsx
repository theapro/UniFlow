"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export type VoiceVizMode = "idle" | "processing" | "speaking";

type Vec3 = { x: number; y: number; z: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c };
}

function rotateX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

function mixColor(mode: VoiceVizMode) {
  // Minimal monochrome glow (avoid blue accents)
  if (mode === "speaking") return { r: 245, g: 245, b: 245 };
  if (mode === "processing") return { r: 220, g: 220, b: 220 };
  return { r: 200, g: 200, b: 200 };
}

export function ParticleSphere(props: {
  mode: VoiceVizMode;
  levelRef: React.MutableRefObject<number>;
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, levelRef, frequencyDataRef, className } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const particles = useMemo(() => {
    const count = 180;

    // Fibonacci sphere distribution
    const pts: Array<{
      base: Vec3;
      seed: number;
      size: number;
    }> = [];

    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = phi * i;
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      pts.push({
        base: { x, y, z },
        seed: (i * 97) % 1000,
        size: 0.9 + (i % 5) * 0.18,
      });
    }

    return pts;
  }, []);

  const links = useMemo(() => {
    // Small fixed neighbor set (avoids O(n^2) distance checks)
    const count = particles.length;
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      edges.push([i, (i + 1) % count]);
      edges.push([i, (i + 7) % count]);
      edges.push([i, (i + 19) % count]);
    }
    return edges;
  }, [particles.length]);

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
      const targetLevel = clamp01(levelRef.current);
      smoothLevel = lerp(smoothLevel, targetLevel, 0.08);

      const { r: cr, g: cg, b: cb } = mixColor(mode);

      const baseRadius = Math.min(w, h) * 0.28;
      const radius =
        baseRadius *
        (1 +
          0.03 * Math.sin(time * 1.15) +
          (mode === "speaking" ? 0.11 * smoothLevel : 0.04 * smoothLevel));

      const rotY = time * (mode === "speaking" ? 0.55 : 0.35);
      const rotX = time * 0.22;

      const freq = frequencyDataRef?.current ?? null;

      ctx.clearRect(0, 0, w, h);

      // Background glow
      const bg = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.2,
        cx,
        cy,
        radius * 2.2,
      );
      bg.addColorStop(0, `rgba(${cr},${cg},${cb},0.10)`);
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Project particles
      const projected: Array<{
        x: number;
        y: number;
        z: number;
        a: number;
        size: number;
      }> = [];

      const fov = 3.0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let v = rotateY(p.base, rotY);
        v = rotateX(v, rotX);

        let audio = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((i / particles.length) * freq.length),
          );
          audio = (freq[bin] / 255) * 2 - 1;
        }

        const displacement =
          (mode === "speaking" ? 0.22 : mode === "processing" ? 0.1 : 0.06) *
          smoothLevel;

        const jitter = 0.02 * Math.sin(time * 2.1 + p.seed);

        const rr = radius * (1 + displacement * audio + jitter);

        const x3 = v.x * rr;
        const y3 = v.y * rr;
        const z3 = v.z * rr;

        const persp = fov / (fov + (z3 / radius) * 1.6);
        const x2 = cx + x3 * persp;
        const y2 = cy + y3 * persp;

        const alpha = clamp01(0.16 + (z3 / (radius * 1.2) + 1) * 0.26);

        projected.push({
          x: x2,
          y: y2,
          z: z3,
          a: alpha,
          size: p.size * (0.6 + persp * 0.6),
        });
      }

      // Lines (network effect)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1;

      for (let e = 0; e < links.length; e++) {
        const [i, j] = links[e];
        const a = projected[i];
        const b = projected[j];
        if (!a || !b) continue;

        const aa = Math.min(a.a, b.a) * (0.05 + 0.16 * smoothLevel);
        if (aa < 0.01) continue;

        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${aa})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();

      // Particles (cheap draw: no per-particle gradients)
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${mode === "speaking" ? 0.55 : 0.35})`;
      ctx.shadowBlur =
        mode === "speaking" ? 18 + 26 * smoothLevel : 12 + 16 * smoothLevel;

      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];

        const pr = Math.max(1.2, p.size * 1.6);
        const a =
          (mode === "processing" ? 0.55 : 0.75) * p.a +
          (mode === "speaking" ? 0.24 * smoothLevel : 0.08 * smoothLevel);

        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.05 + 0.16 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr * 1.35, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.14 * a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Restore glow for next particle
        ctx.shadowBlur =
          mode === "speaking" ? 18 + 26 * smoothLevel : 12 + 16 * smoothLevel;
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
  }, [frequencyDataRef, levelRef, mode, particles, links]);

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
