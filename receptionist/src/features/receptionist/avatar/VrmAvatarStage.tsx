"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";

import { createVrmLipSync, type VrmLipSyncController } from "./VrmLipSync";
import {
  createAssistantAnimationSystem,
  STATES,
  type AssistantAnimState,
  type AssistantAnimationSystem,
} from "./VrmAssistantAnimationSystem";

export type ThreeDLeiaMode = "idle" | "listening" | "processing" | "speaking";

const AVATAR_TRANSFORM_ENABLED_KEY = "receptionistAvatarTransformEnabled";
const AVATAR_TRANSFORM_KEY = "receptionistAvatarTransform";
const AVATAR_TRANSFORM_EVENT = "receptionist:avatar-transform";

type AvatarTransform = {
  position: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
  scale: number;
};

const DEFAULT_AVATAR_TRANSFORM: AvatarTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: 1,
};

function toNum(v: unknown, fb: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fb;
}

function readTransform(): { enabled: boolean; transform: AvatarTransform } {
  if (typeof window === "undefined")
    return { enabled: false, transform: DEFAULT_AVATAR_TRANSFORM };
  const enabled = window.localStorage.getItem(AVATAR_TRANSFORM_ENABLED_KEY);
  let transform = DEFAULT_AVATAR_TRANSFORM;
  try {
    const raw = window.localStorage.getItem(AVATAR_TRANSFORM_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AvatarTransform>;
      transform = {
        position: {
          x: toNum(p.position?.x, 0),
          y: toNum(p.position?.y, 0),
          z: toNum(p.position?.z, 0),
        },
        rotationDeg: {
          x: toNum(p.rotationDeg?.x, 0),
          y: toNum(p.rotationDeg?.y, 0),
          z: toNum(p.rotationDeg?.z, 0),
        },
        scale: toNum(p.scale, 1),
      };
    }
  } catch {
    /**/
  }
  return { enabled: enabled === "1" || enabled === "true", transform };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function getRawBone(vrm: VRM, name: string): THREE.Object3D | null {
  try {
    return (vrm as any)?.humanoid?.getRawBoneNode(name) ?? null;
  } catch {
    return null;
  }
}

function safeExpr(vrm: VRM, key: string, value: number) {
  try {
    (vrm as any)?.expressionManager?.setValue(key, clamp01(value));
  } catch {
    /**/
  }
}

export function VrmAvatarStage(props: {
  mode: ThreeDLeiaMode;
  speakingLevelRef: React.MutableRefObject<number>;
  listeningLevelRef: React.MutableRefObject<number>;
  speakingFrequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  listeningFrequencyDataRef?: React.MutableRefObject<Uint8Array | null>;
  modelUrl?: string;
  className?: string;
  onStatus?: (s: { loaded: boolean; error: string | null }) => void;
}) {
  const {
    mode,
    speakingLevelRef,
    listeningLevelRef,
    speakingFrequencyDataRef,
    listeningFrequencyDataRef,
    modelUrl = "/models/leia.vrm",
    className,
    onStatus,
  } = props;

  const normalizedModelUrl = useMemo(() => {
    // Next.js serves files under `public/` from the site root.
    // Accept legacy paths like `/public/models/leia.vrm`.
    if (!modelUrl) return "/models/leia.vrm";
    if (modelUrl.startsWith("/public/"))
      return modelUrl.replace("/public/", "/");
    if (modelUrl.startsWith("public/"))
      return "/" + modelUrl.replace(/^public\//, "");
    return modelUrl;
  }, [modelUrl]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<ThreeDLeiaMode>(mode);
  const statusCbRef = useRef<typeof onStatus>(onStatus);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    statusCbRef.current = onStatus;
  }, [onStatus]);

  const lipSyncOptions = useMemo(
    () => ({
      minLevel: 0.01,
      pickIntervalMs: { min: 70, max: 130 },
      openSpeed: 18,
      closeSpeed: 26,
    }),
    [],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let mounted = true;

    // ── Scene ────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);

    const basePosV = new THREE.Vector3(0, 0, 0);
    const baseRotE = new THREE.Euler(0, 0, 0);
    const xfRef = { enabled: false, transform: DEFAULT_AVATAR_TRANSFORM };

    const refreshXf = () => {
      const x = readTransform();
      xfRef.enabled = x.enabled;
      xfRef.transform = x.transform;
    };
    const applyXf = () => {
      if (!xfRef.enabled) {
        avatarGroup.position.copy(basePosV);
        avatarGroup.rotation.copy(baseRotE);
        avatarGroup.scale.setScalar(1);
        return;
      }
      const { position: p, rotationDeg: r, scale: s } = xfRef.transform;
      avatarGroup.position.set(
        basePosV.x + p.x,
        basePosV.y + p.y,
        basePosV.z + p.z,
      );
      avatarGroup.rotation.set(
        baseRotE.x + THREE.MathUtils.degToRad(r.x),
        baseRotE.y + THREE.MathUtils.degToRad(r.y),
        baseRotE.z + THREE.MathUtils.degToRad(r.z),
      );
      avatarGroup.scale.setScalar(Math.max(0.001, s));
    };

    refreshXf();
    applyXf();

    // ── Camera + Renderer ────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.42, 1.55);
    camera.lookAt(0, 1.33, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    wrapper.appendChild(renderer.domElement);

    // ── Halo particles ───────────────────────────────────────────────────────
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 1.28, -1.45);
    (haloGroup as any).renderOrder = -10;
    scene.add(haloGroup);

    let haloMat: THREE.PointsMaterial | null = null;
    let haloGeo: THREE.BufferGeometry | null = null;
    let haloPts: THREE.Points | null = null;
    let haloPosAttr: THREE.BufferAttribute | null = null;
    let haloBase: Float32Array | null = null;
    let haloSeeds: Float32Array | null = null;

    (() => {
      const N = 1100;
      const base = new Float32Array(N * 3);
      const pos = new Float32Array(N * 3);
      const seeds = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const th = Math.random() * Math.PI * 2;
        const rr = 0.32 + 0.7 * Math.pow(Math.random(), 0.55);
        const idx = i * 3;
        base[idx] = pos[idx] = rr * Math.cos(th);
        base[idx + 1] = pos[idx + 1] =
          rr * Math.sin(th) * 0.82 + (Math.random() - 0.5) * 0.06;
        base[idx + 2] = pos[idx + 2] = -(0.08 + Math.random() * 0.36);
        seeds[idx] = Math.random();
        seeds[idx + 1] = Math.random();
        seeds[idx + 2] = Math.random();
      }
      haloGeo = new THREE.BufferGeometry();
      haloPosAttr = new THREE.BufferAttribute(pos, 3);
      haloPosAttr.setUsage(THREE.DynamicDrawUsage);
      haloGeo.setAttribute("position", haloPosAttr);
      haloBase = base;
      haloSeeds = seeds;
      haloMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.01,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      });
      haloPts = new THREE.Points(haloGeo, haloMat);
      (haloPts as any).renderOrder = -10;
      haloGroup.add(haloPts);
    })();

    // ── Lights ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const kl = new THREE.DirectionalLight(0xffffff, 1.15);
    kl.position.set(1.25, 1.55, 2.25);
    scene.add(kl);
    const fl = new THREE.DirectionalLight(0xffffff, 0.35);
    fl.position.set(-1.3, 1.1, -1.6);
    scene.add(fl);
    const rl = new THREE.DirectionalLight(0xffffff, 0.45);
    rl.position.set(-1.6, 1.6, 0.2);
    scene.add(rl);

    // ── State ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();

    let vrm: VRM | null = null;
    let headBone: THREE.Object3D | null = null;
    let neckBone: THREE.Object3D | null = null;
    let animSystem: AssistantAnimationSystem | null = null;
    let lookAt: THREE.Object3D | null = null;
    let lipSync: VrmLipSyncController | null = null;

    // Micro-motion stored as Euler so undo is exact.
    const microH = new THREE.Euler();
    const microN = new THREE.Euler();

    const extOvr = { state: null as AssistantAnimState | null, untilMs: 0 };
    let lastState: AssistantAnimState = STATES.IDLE;

    const nextBlink = { v: 0 };
    const blinkAt = { v: 0 };
    const blinking = { v: false };

    const setStatus = (s: { loaded: boolean; error: string | null }) =>
      statusCbRef.current?.(s);
    setStatus({ loaded: false, error: null });

    // ── Event listeners ───────────────────────────────────────────────────────
    const onAvatarState = (ev: Event) => {
      const d = (ev as CustomEvent<any>)?.detail;
      if (!d) return;
      const s = d.state as AssistantAnimState;
      if (s !== STATES.IDLE && s !== STATES.THINKING && s !== STATES.TALKING)
        return;
      const ttl = typeof d.ttlMs === "number" ? d.ttlMs : 0;
      extOvr.state = s;
      extOvr.untilMs =
        ttl > 0 ? (performance?.now() ?? Date.now()) + ttl : Infinity;
    };

    window.addEventListener(
      "receptionist:avatar-state",
      onAvatarState as EventListener,
    );
    window.addEventListener(AVATAR_TRANSFORM_EVENT, refreshXf);
    window.addEventListener("storage", refreshXf);

    // ── Load VRM ──────────────────────────────────────────────────────────────
    (async () => {
      try {
        const loader = new GLTFLoader();
        loader.register((p) => new VRMLoaderPlugin(p));
        const gltf = await loader.loadAsync(normalizedModelUrl);
        if (!mounted) return;

        const loaded = (gltf as any)?.userData?.vrm as VRM | undefined;
        if (!loaded) throw new Error("VRM not in userData");
        vrm = loaded;

        // Disable spring bones (jiggle physics).
        try {
          const sb = (vrm as any)?.springBoneManager;
          if (sb?.joints?.clear) sb.joints.clear();
        } catch {
          /**/
        }

        // CRITICAL: stop VRMHumanoid from overwriting raw bone rotations.
        try {
          const hum = (vrm as any)?.humanoid;
          if (hum) hum.autoUpdateHumanBones = false;
        } catch {
          /**/
        }

        // Ground + orient.
        vrm.scene.scale.set(1, 1, 1);
        vrm.scene.position.set(0, 0, 0);
        vrm.scene.rotation.set(0, Math.PI, 0);
        vrm.scene.updateWorldMatrix(true, true);

        try {
          const box = new THREE.Box3().setFromObject(vrm.scene);
          if (Number.isFinite(box.min.y) && box.max.y - box.min.y > 0.2) {
            vrm.scene.position.y -= box.min.y;
            vrm.scene.updateWorldMatrix(true, true);
          }
        } catch {
          /**/
        }

        avatarGroup.add(vrm.scene);

        headBone = getRawBone(vrm, "head");
        neckBone = getRawBone(vrm, "neck");
        const rArm = getRawBone(vrm, "rightUpperArm");
        const lArm = getRawBone(vrm, "leftUpperArm");

        // ── A-pose arm correction ────────────────────────────────────────────
        // Applied HERE, before createAssistantAnimationSystem, so the
        // rest-pose snapshot inside it captures the corrected quaternions.
        // The animation system will NOT call skeleton.pose() on the live mesh.
        const ARM_DOWN = 1.15,
          ARM_FWD = 0.08,
          ARM_YAW = 0.08;
        if (rArm) {
          rArm.rotation.z -= ARM_DOWN;
          rArm.rotation.x += ARM_FWD;
          rArm.rotation.y += ARM_YAW;
        }
        if (lArm) {
          lArm.rotation.z += ARM_DOWN;
          lArm.rotation.x += ARM_FWD;
          lArm.rotation.y -= ARM_YAW;
        }

        // Update matrices so the snapshot sees the corrected state.
        vrm.scene.updateWorldMatrix(true, true);

        // Look-at.
        lookAt = new THREE.Object3D();
        lookAt.position.set(camera.position.x, 1.34, camera.position.z - 0.55);
        scene.add(lookAt);
        const la = (vrm as any)?.lookAt;
        if (la && "target" in la) la.target = lookAt;

        // Blink.
        nextBlink.v = clock.getElapsedTime() + 2 + Math.random() * 4;

        // Lip sync.
        lipSync = createVrmLipSync(vrm, lipSyncOptions);

        setStatus({ loaded: true, error: null });

        // Load animations (non-blocking).
        void (async () => {
          try {
            const sys = await createAssistantAnimationSystem({
              vrm: vrm!,
              mixerRoot: vrm!.scene,
              animationsBasePath: "/animations",
              fadeSeconds: 0.35,
              minThinkingMs: 700,
            });
            if (!mounted) {
              sys.dispose();
              return;
            }
            animSystem = sys;
          } catch (e) {
            console.warn(
              "[avatar] anim system failed, using procedural idle:",
              e,
            );
          }
        })();
      } catch (e) {
        console.error("[avatar] VRM load error:", e);
        setStatus({
          loaded: false,
          error: e instanceof Error ? e.message : "VRM load failed",
        });
      }
    })();

    // ── Resize ───────────────────────────────────────────────────────────────
    const resize = () => {
      const { width: w, height: h } = wrapper.getBoundingClientRect();
      renderer.setSize(
        Math.max(1, Math.floor(w)),
        Math.max(1, Math.floor(h)),
        false,
      );
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    // ── Blink ────────────────────────────────────────────────────────────────
    const updateBlink = (t: number) => {
      if (!vrm) return;
      if (!blinking.v && t >= nextBlink.v) {
        blinking.v = true;
        blinkAt.v = t;
      }
      if (!blinking.v) return;
      const p = (t - blinkAt.v) / 0.22;
      if (p >= 1) {
        blinking.v = false;
        nextBlink.v = t + 2 + Math.random() * 4;
        safeExpr(vrm, "blink", 0);
        return;
      }
      safeExpr(vrm, "blink", p < 0.5 ? p * 2 : (1 - p) * 2);
    };

    // ── Render loop ──────────────────────────────────────────────────────────
    let raf = 0;

    const animate = () => {
      if (!mounted) return;
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();
      const speak = clamp01(speakingLevelRef.current);
      const listen = clamp01(listeningLevelRef.current);
      const act = Math.max(speak, listen * 0.85);

      // Halo drift.
      if (haloPosAttr && haloBase && haloSeeds) {
        const pos = haloPosAttr.array as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
          const sx = haloSeeds[i],
            sy = haloSeeds[i + 1],
            sz = haloSeeds[i + 2];
          pos[i] =
            haloBase[i] +
            Math.sin(t * (0.16 + sx * 0.22) + sy * Math.PI * 2) * 0.018;
          pos[i + 1] =
            haloBase[i + 1] +
            Math.cos(t * (0.14 + sy * 0.2) + sz * Math.PI * 2) * 0.015;
          pos[i + 2] = Math.min(
            -0.05,
            haloBase[i + 2] +
              Math.sin(t * (0.12 + sz * 0.22) + sx * Math.PI * 2) * 0.01,
          );
        }
        haloPosAttr.needsUpdate = true;
      }
      haloGroup.position.x = Math.sin(t * 0.06) * 0.03;
      haloGroup.position.y = 1.28 + Math.sin(t * 0.07 + 1.1) * 0.03;
      haloGroup.scale.setScalar(1 + act * 0.12);
      if (haloMat) haloMat.opacity = 0.14 + act * 0.34;

      applyXf();

      if (vrm) {
        try {
          updateBlink(t);

          // Desired anim state.
          const m = modeRef.current;
          const now = performance?.now() ?? Date.now();
          const ext =
            extOvr.state && now < extOvr.untilMs ? extOvr.state : null;
          if (!ext) extOvr.state = null;

          const desired: AssistantAnimState =
            m === "speaking"
              ? STATES.TALKING
              : m === "processing"
                ? STATES.THINKING
                : (ext ?? STATES.IDLE);

          if (desired !== lastState) {
            lastState = desired;
            animSystem?.setState(desired);
          }

          // Micro-motion: undo → mixer → redo.
          if (headBone) {
            headBone.rotation.x -= microH.x;
            headBone.rotation.y -= microH.y;
            headBone.rotation.z -= microH.z;
          }
          if (neckBone) {
            neckBone.rotation.x -= microN.x;
            neckBone.rotation.y -= microN.y;
            neckBone.rotation.z -= microN.z;
          }

          animSystem?.update(delta);

          const st = animSystem?.getCurrentState() ?? desired;
          const thinking = st === STATES.THINKING;
          const talking = st === STATES.TALKING;

          microH.x =
            Math.sin(t * 0.27) * 0.01 +
            (thinking ? -0.07 + Math.sin(t * 0.55) * 0.015 : 0) +
            (talking ? Math.sin(t * 5.8) * 0.014 * speak : 0);
          microH.y =
            Math.sin(t * 0.22) * 0.02 +
            (thinking ? 0.055 + Math.sin(t * 0.4 + 1.7) * 0.015 : 0);
          microH.z =
            Math.sin(t * 0.18) * 0.012 +
            (thinking ? 0.08 + Math.sin(t * 0.36 + 0.4) * 0.02 : 0);
          microN.x = microH.x * 0.35;
          microN.y = microH.y * 0.35;
          microN.z = microH.z * 0.25;

          if (headBone) {
            headBone.rotation.x += microH.x;
            headBone.rotation.y += microH.y;
            headBone.rotation.z += microH.z;
          }
          if (neckBone) {
            neckBone.rotation.x += microN.x;
            neckBone.rotation.y += microN.y;
            neckBone.rotation.z += microN.z;
          }

          // Eye drift.
          if (lookAt) {
            const ax = thinking ? 0.11 : 0.08,
              ay = thinking ? 0.05 : 0.035;
            lookAt.position.x = camera.position.x + Math.sin(t * 0.35) * ax;
            lookAt.position.y =
              1.34 + Math.sin(t * 0.27 + 1.1) * ay + (thinking ? -0.04 : 0);
            lookAt.position.z = camera.position.z - 0.55;
          }

          // Lip sync.
          const lipOn = m === "speaking" || m === "listening";
          const lipLevel =
            m === "speaking" ? speak : m === "listening" ? listen : 0;
          const lipFreq =
            m === "speaking"
              ? speakingFrequencyDataRef?.current
              : m === "listening"
                ? listeningFrequencyDataRef?.current
                : null;
          lipSync?.update({
            now: t,
            delta,
            level: lipLevel,
            frequencyData: lipFreq,
            enabled: lipOn,
          });

          try {
            vrm.update(delta);
          } catch {
            /**/
          }
        } catch (e) {
          console.error("[avatar] frame error:", e);
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      mounted = false;
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener(
        "receptionist:avatar-state",
        onAvatarState as EventListener,
      );
      window.removeEventListener(AVATAR_TRANSFORM_EVENT, refreshXf);
      window.removeEventListener("storage", refreshXf);
      try {
        wrapper.removeChild(renderer.domElement);
      } catch {
        /**/
      }
      try {
        renderer.dispose();
      } catch {
        /**/
      }
      try {
        animSystem?.dispose();
      } catch {
        /**/
      }
      if (vrm) {
        try {
          vrm.scene.traverse((o: any) => {
            o?.geometry?.dispose?.();
            const m = o?.material;
            if (m)
              (Array.isArray(m) ? m : [m]).forEach((x: any) => x?.dispose?.());
            o?.texture?.dispose?.();
          });
        } catch {
          /**/
        }
      }
      try {
        if (haloPts) haloGroup.remove(haloPts);
        haloGeo?.dispose();
        haloMat?.dispose();
      } catch {
        /**/
      }
    };
  }, [
    normalizedModelUrl,
    lipSyncOptions,
    speakingLevelRef,
    listeningLevelRef,
    speakingFrequencyDataRef,
    listeningFrequencyDataRef,
  ]);

  return (
    <div
      ref={wrapperRef}
      className={cn("absolute inset-0", "pointer-events-none", className)}
      aria-label="3D LEIA avatar"
    />
  );
}
