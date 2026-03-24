"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { VoiceVizMode } from "@/components/voice/ParticleSphere";

import * as THREE from "three";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixColor(mode: VoiceVizMode) {
  if (mode === "speaking") return new THREE.Color("rgb(99,102,241)"); // indigo
  if (mode === "processing") return new THREE.Color("rgb(59,130,246)"); // blue
  return new THREE.Color("rgb(16,185,129)"); // emerald
}

type Vec3 = { x: number; y: number; z: number };

function fibonacciSpherePoints(count: number): Vec3[] {
  const pts: Vec3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    pts.push({ x, y, z });
  }
  return pts;
}

export function ThreeSphere(props: {
  mode: VoiceVizMode;
  levelRef: React.MutableRefObject<number>;
  frequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  className?: string;
}) {
  const { mode, levelRef, frequencyDataRef, className } = props;

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const basePoints = useMemo(() => fibonacciSpherePoints(1600), []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let mounted = true;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    wrapper.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(basePoints.length * 3);
    const base = new Float32Array(basePoints.length * 3);

    for (let i = 0; i < basePoints.length; i++) {
      const p = basePoints[i];
      base[i * 3 + 0] = p.x;
      base[i * 3 + 1] = p.y;
      base[i * 3 + 2] = p.z;
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: mixColor(mode),
      size: 0.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Subtle halo
    const haloMat = new THREE.PointsMaterial({
      color: new THREE.Color("white"),
      size: 0.03,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const halo = new THREE.Points(geometry, haloMat);
    halo.scale.setScalar(1.04);
    scene.add(halo);

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrapper);

    let raf = 0;
    let smoothLevel = 0;

    const animate = (t: number) => {
      if (!mounted) return;

      const time = t * 0.001;
      const target = clamp01(levelRef.current);
      smoothLevel = lerp(smoothLevel, target, 0.08);

      // Update colors on mode transitions (cheap)
      material.color.copy(mixColor(mode));

      const freq = frequencyDataRef?.current ?? null;

      const posAttr = geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;

      const audioStrength =
        (mode === "speaking" ? 0.42 : mode === "processing" ? 0.18 : 0.12) *
        smoothLevel;

      for (let i = 0; i < basePoints.length; i++) {
        const bx = base[i * 3 + 0];
        const by = base[i * 3 + 1];
        const bz = base[i * 3 + 2];

        let amp = 0;
        if (freq) {
          const bin = Math.min(
            freq.length - 1,
            Math.floor((i / basePoints.length) * freq.length),
          );
          amp = freq[bin] / 255;
        }

        const wave = 0.06 * Math.sin(time * 1.35 + i * 0.02);
        const k = 1 + wave + audioStrength * (amp * 1.4);

        arr[i * 3 + 0] = bx * k;
        arr[i * 3 + 1] = by * k;
        arr[i * 3 + 2] = bz * k;
      }

      posAttr.needsUpdate = true;

      points.rotation.y = time * 0.22;
      points.rotation.x = time * 0.12;
      halo.rotation.copy(points.rotation);

      const scale =
        1 +
        0.06 * Math.sin(time * 1.0) +
        (mode === "speaking" ? 0.14 * smoothLevel : 0.05 * smoothLevel);
      points.scale.setScalar(scale);

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    raf = window.requestAnimationFrame(animate);

    return () => {
      mounted = false;
      ro.disconnect();
      window.cancelAnimationFrame(raf);
      try {
        wrapper.removeChild(renderer.domElement);
      } catch {
        // ignore
      }
      geometry.dispose();
      material.dispose();
      haloMat.dispose();
      renderer.dispose();
    };
  }, [basePoints, frequencyDataRef, levelRef, mode]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative aspect-square w-[340px] max-w-[75vw]",
        "[mask-image:radial-gradient(circle_at_center,black_64%,transparent_100%)]",
        className,
      )}
    />
  );
}
