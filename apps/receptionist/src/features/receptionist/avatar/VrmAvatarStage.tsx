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

function toFiniteNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function readAvatarTransformFromStorage(): {
  enabled: boolean;
  transform: AvatarTransform;
} {
  if (typeof window === "undefined") {
    return { enabled: false, transform: DEFAULT_AVATAR_TRANSFORM };
  }

  const enabledRaw = window.localStorage.getItem(AVATAR_TRANSFORM_ENABLED_KEY);
  const enabled = enabledRaw === "1" || enabledRaw === "true";

  let transform = DEFAULT_AVATAR_TRANSFORM;
  try {
    const raw = window.localStorage.getItem(AVATAR_TRANSFORM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AvatarTransform>;
      transform = {
        position: {
          x: toFiniteNumber(parsed.position?.x, 0),
          y: toFiniteNumber(parsed.position?.y, 0),
          z: toFiniteNumber(parsed.position?.z, 0),
        },
        rotationDeg: {
          x: toFiniteNumber(parsed.rotationDeg?.x, 0),
          y: toFiniteNumber(parsed.rotationDeg?.y, 0),
          z: toFiniteNumber(parsed.rotationDeg?.z, 0),
        },
        scale: toFiniteNumber(parsed.scale, 1),
      };
    }
  } catch {
    // ignore invalid JSON
  }

  return { enabled, transform };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

type BoneKey = "neck" | "head" | "rightUpperArm" | "leftUpperArm";

function getBone(vrm: VRM, name: BoneKey) {
  // Use RAW bones for animation stability. The VRM "normalized" rig is made of
  // plain Object3D nodes and is meant to *drive* raw bones via autoUpdate.
  // For external animation playback we animate raw bones directly.
  const humanoid = (vrm as any)?.humanoid;
  if (!humanoid) return null;
  return humanoid.getRawBoneNode(name) as THREE.Object3D | null;
}

function safeSetExpression(vrm: VRM, key: string, value: number) {
  const mgr = (vrm as any)?.expressionManager;
  if (!mgr) return;
  try {
    mgr.setValue(key, clamp01(value));
  } catch {
    // ignore if expression not present
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
    modelUrl = "/receptionist/assets/3dleia/leia.vrm",
    className,
    onStatus,
  } = props;

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const modeRef = useRef<ThreeDLeiaMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const statusCbRef = useRef<typeof onStatus>(onStatus);
  useEffect(() => {
    statusCbRef.current = onStatus;
  }, [onStatus]);

  const lipSyncOptions = useMemo(
    () => ({
      // Tuned for analyser output in 0..1 range.
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

    const scene = new THREE.Scene();

    // Avatar container group: keeps base orientation/position stable and
    // lets us apply debug transform overrides without fighting the mixer.
    const avatarGroup = new THREE.Group();
    scene.add(avatarGroup);

    // Base placement. The VRM itself is grounded via its bounding box so the
    // feet sit on Y=0; this group stays as a stable parent for debug offsets.
    const baseAvatarPosition = new THREE.Vector3(0, 0, 0);
    const baseAvatarRotation = new THREE.Euler(0, 0, 0);

    const avatarTransformRef = {
      enabled: false,
      transform: DEFAULT_AVATAR_TRANSFORM,
    };

    const refreshAvatarTransform = () => {
      const next = readAvatarTransformFromStorage();
      avatarTransformRef.enabled = next.enabled;
      avatarTransformRef.transform = next.transform;
    };

    const applyAvatarTransform = () => {
      const { enabled, transform } = avatarTransformRef;

      if (!enabled) {
        avatarGroup.position.copy(baseAvatarPosition);
        avatarGroup.rotation.copy(baseAvatarRotation);
        avatarGroup.scale.setScalar(1);
        return;
      }

      avatarGroup.position.set(
        baseAvatarPosition.x + transform.position.x,
        baseAvatarPosition.y + transform.position.y,
        baseAvatarPosition.z + transform.position.z,
      );

      avatarGroup.rotation.set(
        baseAvatarRotation.x +
          THREE.MathUtils.degToRad(transform.rotationDeg.x),
        baseAvatarRotation.y +
          THREE.MathUtils.degToRad(transform.rotationDeg.y),
        baseAvatarRotation.z +
          THREE.MathUtils.degToRad(transform.rotationDeg.z),
      );

      const s = Math.max(0.001, transform.scale);
      avatarGroup.scale.setScalar(s);
    };

    // Initialize from persisted settings (if any).
    refreshAvatarTransform();
    applyAvatarTransform();

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.42, 1.55);
    camera.lookAt(0, 1.33, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Ensure the canvas participates in layout cleanly.
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    wrapper.appendChild(renderer.domElement);

    // Particle field (must stay BEHIND the avatar; never overlay the model)
    const haloGroup = new THREE.Group();
    haloGroup.position.set(0, 1.28, -1.45);
    (haloGroup as any).renderOrder = -10;
    scene.add(haloGroup);

    let haloMaterial: THREE.PointsMaterial | null = null;
    let haloGeometry: THREE.BufferGeometry | null = null;
    let haloPoints: THREE.Points | null = null;
    let haloPositionAttr: THREE.BufferAttribute | null = null;
    let haloBasePositions: Float32Array | null = null;
    let haloSeeds: Float32Array | null = null;

    const createHalo = () => {
      // Disc-like nebula behind the avatar (no particles in front of the mesh).
      const count = 1100;
      const basePositions = new Float32Array(count * 3);
      const positions = new Float32Array(count * 3);
      const seeds = new Float32Array(count * 3);

      const rMin = 0.32;
      const rMax = 1.02;
      const yScale = 0.82;

      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        // Bias toward the outer ring for a cleaner silhouette.
        const rr = rMin + (rMax - rMin) * Math.pow(Math.random(), 0.55);

        const x = rr * Math.cos(theta);
        const y = rr * Math.sin(theta) * yScale + (Math.random() - 0.5) * 0.06;

        // IMPORTANT: keep all particles strictly behind the avatar.
        // haloGroup is already behind; we only add negative depth jitter.
        const z = -(0.08 + Math.random() * 0.36);

        const idx = i * 3;
        basePositions[idx] = x;
        basePositions[idx + 1] = y;
        basePositions[idx + 2] = z;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;

        // Per-particle drift seeds.
        seeds[idx] = Math.random();
        seeds[idx + 1] = Math.random();
        seeds[idx + 2] = Math.random();
      }

      haloGeometry = new THREE.BufferGeometry();
      haloPositionAttr = new THREE.BufferAttribute(positions, 3);
      haloPositionAttr.setUsage(THREE.DynamicDrawUsage);
      haloGeometry.setAttribute("position", haloPositionAttr);

      haloBasePositions = basePositions;
      haloSeeds = seeds;

      haloMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.01,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        depthTest: true,
      });

      haloPoints = new THREE.Points(haloGeometry, haloMaterial);
      (haloPoints as any).renderOrder = -10;
      haloGroup.add(haloPoints);
    };

    createHalo();

    // Lighting (neutral, minimal)
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(1.25, 1.55, 2.25);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-1.3, 1.1, -1.6);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(-1.6, 1.6, 0.2);
    scene.add(rim);

    const clock = new THREE.Clock();

    let vrm: VRM | null = null;
    let headBone: THREE.Object3D | null = null;
    let neckBone: THREE.Object3D | null = null;
    let animSystem: AssistantAnimationSystem | null = null;
    let lookAtTarget: THREE.Object3D | null = null;

    const micro = {
      head: { x: 0, y: 0, z: 0 },
      neck: { x: 0, y: 0, z: 0 },
    };

    const externalOverride = {
      state: null as AssistantAnimState | null,
      untilMs: 0,
    };

    let lastRequestedState: AssistantAnimState = STATES.IDLE;

    let lipSync: VrmLipSyncController | null = null;

    const nextBlinkAtRef = { v: 0 };
    const blinkStartAtRef = { v: 0 };
    const blinkingRef = { v: false };

    // (lip sync controller maintains its own internal scheduling)

    const setStatus = (s: { loaded: boolean; error: string | null }) => {
      statusCbRef.current?.(s);
    };

    setStatus({ loaded: false, error: null });

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    const onAvatarState = (ev: Event) => {
      const detail = (ev as CustomEvent<any>)?.detail;
      if (!detail) return;
      const state = detail.state as AssistantAnimState | undefined;
      if (!state) return;
      if (
        state !== STATES.IDLE &&
        state !== STATES.THINKING &&
        state !== STATES.TALKING
      ) {
        return;
      }
      const ttlMs = typeof detail.ttlMs === "number" ? detail.ttlMs : 0;
      externalOverride.state = state;
      externalOverride.untilMs =
        ttlMs > 0
          ? (typeof performance === "undefined"
              ? Date.now()
              : performance.now()) + ttlMs
          : Number.POSITIVE_INFINITY;
    };

    window.addEventListener(
      "receptionist:avatar-state",
      onAvatarState as EventListener,
    );

    const onAvatarTransformChanged = () => {
      refreshAvatarTransform();
    };

    window.addEventListener(
      AVATAR_TRANSFORM_EVENT,
      onAvatarTransformChanged as EventListener,
    );
    window.addEventListener("storage", onAvatarTransformChanged);

    (async () => {
      try {
        const gltf = await loader.loadAsync(modelUrl);
        if (!mounted) return;

        const loaded = (gltf as any)?.userData?.vrm as VRM | undefined;
        if (!loaded) {
          throw new Error("VRM not found in glTF userData");
        }

        vrm = loaded;

        // Remove unwanted physics / jiggle (spring bones).
        // This disables secondary motion like chest/hair jiggle.
        try {
          const sb = (vrm as any)?.springBoneManager;
          if (sb?.joints && typeof sb.joints.clear === "function") {
            sb.joints.clear();
          }
        } catch {
          // ignore
        }

        // Ensure normalized rig updates propagate to the rendered skeleton.
        // We animate RAW bones (SkinnedMesh skeleton) and must prevent VRMHumanoid
        // from overwriting them each frame.
        try {
          const humanoid = (vrm as any)?.humanoid;
          if (humanoid && typeof humanoid === "object") {
            humanoid.autoUpdateHumanBones = false;
          }
        } catch {
          // ignore
        }

        // === MODEL TRANSFORM FIX ===
        // Keep a consistent base scale, reset position, and rotate to face forward.
        // Ground the model by lifting it so its bounding-box min-Y becomes 0.
        vrm.scene.scale.set(1, 1, 1);
        vrm.scene.position.set(0, 0, 0);
        vrm.scene.rotation.set(0, Math.PI, 0);

        try {
          vrm.scene.updateWorldMatrix(true, true);
          const box = new THREE.Box3().setFromObject(vrm.scene);
          if (
            Number.isFinite(box.min.y) &&
            Number.isFinite(box.max.y) &&
            box.max.y - box.min.y > 0.2
          ) {
            vrm.scene.position.y -= box.min.y;
            vrm.scene.updateWorldMatrix(true, true);
          }
        } catch {
          // ignore
        }

        avatarGroup.add(vrm.scene);

        headBone = getBone(vrm, "head");
        neckBone = getBone(vrm, "neck");
        const rightUpperArm = getBone(vrm, "rightUpperArm");
        const leftUpperArm = getBone(vrm, "leftUpperArm");

        // Pose correction: nudge toward a relaxed A-pose.
        const ARM_DOWN = 1.15;
        const ARM_FORWARD = 0.08;
        const ARM_YAW = 0.08;

        // Apply immediately so the first frame isn't a T-pose.
        if (rightUpperArm) {
          rightUpperArm.rotation.z -= ARM_DOWN;
          rightUpperArm.rotation.x += ARM_FORWARD;
          rightUpperArm.rotation.y += ARM_YAW;
        }
        if (leftUpperArm) {
          leftUpperArm.rotation.z += ARM_DOWN;
          leftUpperArm.rotation.x += ARM_FORWARD;
          leftUpperArm.rotation.y -= ARM_YAW;
        }

        // Look-at target drift for micro eye motion.
        lookAtTarget = new THREE.Object3D();
        lookAtTarget.position.set(
          camera.position.x,
          1.34,
          camera.position.z - 0.55,
        );
        scene.add(lookAtTarget);
        const lookAt = (vrm as any)?.lookAt;
        if (lookAt && typeof lookAt === "object" && "target" in lookAt) {
          (lookAt as any).target = lookAtTarget;
        }

        // Initialize blink schedule.
        const t = clock.getElapsedTime();
        nextBlinkAtRef.v = t + 2 + Math.random() * 4;
        // initialize lip sync
        lipSync = createVrmLipSync(vrm, lipSyncOptions);

        // Consider the avatar "loaded" as soon as the model is ready.
        setStatus({ loaded: true, error: null });

        // Load animation clips in the background (don't block initial render).
        void (async () => {
          try {
            const mixerRoot = vrm.scene;
            const sys = await createAssistantAnimationSystem({
              vrm,
              mixerRoot,
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
              "[receptionist-avatar] animation system init failed; falling back to procedural idle",
              e,
            );
            animSystem = null;
          }
        })();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "VRM load failed";
        console.error("[receptionist-avatar] VRM load error", e);
        setStatus({ loaded: false, error: msg });
      }
    })();

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

    const updateBlink = (t: number) => {
      if (!vrm) return;

      if (!blinkingRef.v && t >= nextBlinkAtRef.v) {
        blinkingRef.v = true;
        blinkStartAtRef.v = t;
      }

      if (!blinkingRef.v) return;

      const duration = 0.22;
      const p = (t - blinkStartAtRef.v) / duration;
      if (p >= 1) {
        blinkingRef.v = false;
        nextBlinkAtRef.v = t + 2 + Math.random() * 4;
        safeSetExpression(vrm, "blink", 0);
        return;
      }

      const v = p < 0.5 ? p * 2 : (1 - p) * 2;
      safeSetExpression(vrm, "blink", v);
    };

    const animate = () => {
      if (!mounted) return;

      const delta = clock.getDelta();
      const t = clock.getElapsedTime();

      const speak = clamp01(speakingLevelRef.current);
      const listen = clamp01(listeningLevelRef.current);
      const activity = Math.max(speak, listen * 0.85);

      // Drift particles (no rotation/spinning).
      if (haloPositionAttr && haloBasePositions && haloSeeds) {
        const pos = haloPositionAttr.array as Float32Array;
        const base = haloBasePositions;
        const seeds = haloSeeds;

        const driftXY = 0.018;
        const driftZ = 0.01;
        for (let i = 0; i < pos.length; i += 3) {
          const sx = seeds[i];
          const sy = seeds[i + 1];
          const sz = seeds[i + 2];

          pos[i] =
            base[i] +
            Math.sin(t * (0.16 + sx * 0.22) + sy * Math.PI * 2) * driftXY;
          pos[i + 1] =
            base[i + 1] +
            Math.cos(t * (0.14 + sy * 0.2) + sz * Math.PI * 2) *
              (driftXY * 0.85);
          const zBase = base[i + 2];
          const zDrift =
            Math.sin(t * (0.12 + sz * 0.22) + sx * Math.PI * 2) * driftZ;
          pos[i + 2] = Math.min(-0.05, zBase + zDrift);
        }
        haloPositionAttr.needsUpdate = true;
      }

      // Gentle group float (still behind the model).
      haloGroup.position.x = Math.sin(t * 0.06) * 0.03;
      haloGroup.position.y = 1.28 + Math.sin(t * 0.07 + 1.1) * 0.03;

      const haloScale = 1 + activity * 0.12;
      haloGroup.scale.setScalar(haloScale);
      if (haloMaterial) {
        haloMaterial.opacity = 0.14 + activity * 0.34;
      }

      // Keep avatar base placement stable (and apply debug overrides).
      applyAvatarTransform();

      if (vrm) {
        try {
          updateBlink(t);

          // Animation state (voice lifecycle has priority; optional external override for chat).
          const m = modeRef.current;
          const nowMs =
            typeof performance === "undefined" ? Date.now() : performance.now();
          const externalActive =
            externalOverride.state && nowMs < externalOverride.untilMs
              ? externalOverride.state
              : null;
          if (!externalActive) {
            externalOverride.state = null;
          }

          const desired: AssistantAnimState =
            m === "speaking"
              ? STATES.TALKING
              : m === "processing"
                ? STATES.THINKING
                : externalActive
                  ? externalActive
                  : STATES.IDLE;

          if (desired !== lastRequestedState && animSystem) {
            animSystem.setState(desired);
            lastRequestedState = desired;
          }

          // Undo previous micro offsets so the mixer always writes cleanly.
          if (headBone) {
            headBone.rotation.x -= micro.head.x;
            headBone.rotation.y -= micro.head.y;
            headBone.rotation.z -= micro.head.z;
          }
          if (neckBone) {
            neckBone.rotation.x -= micro.neck.x;
            neckBone.rotation.y -= micro.neck.y;
            neckBone.rotation.z -= micro.neck.z;
          }

          animSystem?.update(delta);

          const stateForMicro = animSystem?.getCurrentState?.() ?? desired;

          // Micro head motion (subtle; shouldn't override the main clips).
          const baseSwayY = Math.sin(t * 0.22) * 0.02;
          const baseSwayZ = Math.sin(t * 0.18) * 0.012;
          const baseSwayX = Math.sin(t * 0.27) * 0.01;

          const thinking = stateForMicro === STATES.THINKING;
          const talking = stateForMicro === STATES.TALKING;

          const thinkTiltX = thinking ? -0.07 + Math.sin(t * 0.55) * 0.015 : 0;
          const thinkTiltY = thinking
            ? 0.055 + Math.sin(t * 0.4 + 1.7) * 0.015
            : 0;
          const thinkTiltZ = thinking
            ? 0.08 + Math.sin(t * 0.36 + 0.4) * 0.02
            : 0;

          const talkBob = talking ? Math.sin(t * 5.8) * 0.014 * speak : 0;

          micro.head.x = baseSwayX + thinkTiltX + talkBob;
          micro.head.y = baseSwayY + thinkTiltY;
          micro.head.z = baseSwayZ + thinkTiltZ;

          micro.neck.x = micro.head.x * 0.35;
          micro.neck.y = micro.head.y * 0.35;
          micro.neck.z = micro.head.z * 0.25;

          if (headBone) {
            headBone.rotation.x += micro.head.x;
            headBone.rotation.y += micro.head.y;
            headBone.rotation.z += micro.head.z;
          }
          if (neckBone) {
            neckBone.rotation.x += micro.neck.x;
            neckBone.rotation.y += micro.neck.y;
            neckBone.rotation.z += micro.neck.z;
          }

          // Slow eye/look drift.
          if (lookAtTarget) {
            const ampX = thinking ? 0.11 : 0.08;
            const ampY = thinking ? 0.05 : 0.035;
            const baseX = camera.position.x;
            const baseY = 1.34;
            const baseZ = camera.position.z - 0.55;
            lookAtTarget.position.x = baseX + Math.sin(t * 0.35) * ampX;
            lookAtTarget.position.y =
              baseY + Math.sin(t * 0.27 + 1.1) * ampY + (thinking ? -0.04 : 0);
            lookAtTarget.position.z = baseZ;
          }

          const lipEnabled = m === "speaking" || m === "listening";
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
            enabled: lipEnabled,
          });

          try {
            vrm.update(delta);
          } catch {
            // ignore
          }
        } catch (e) {
          console.error("[receptionist-avatar] frame update failed", e);
        }
      }

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    raf = window.requestAnimationFrame(animate);

    return () => {
      mounted = false;
      ro.disconnect();
      window.cancelAnimationFrame(raf);
      window.removeEventListener(
        "receptionist:avatar-state",
        onAvatarState as EventListener,
      );
      window.removeEventListener(
        AVATAR_TRANSFORM_EVENT,
        onAvatarTransformChanged as EventListener,
      );
      window.removeEventListener("storage", onAvatarTransformChanged);

      try {
        wrapper.removeChild(renderer.domElement);
      } catch {
        // ignore
      }

      try {
        renderer.dispose();
      } catch {
        // ignore
      }

      try {
        animSystem?.dispose();
      } catch {
        // ignore
      }

      // Best-effort dispose of the VRM scene graph.
      if (vrm) {
        try {
          vrm.scene.traverse((obj: any) => {
            if (obj?.geometry?.dispose) obj.geometry.dispose();
            if (obj?.material) {
              const m = obj.material;
              if (Array.isArray(m)) {
                m.forEach((mm) => {
                  if (mm?.dispose) mm.dispose();
                });
              } else if (m?.dispose) {
                m.dispose();
              }
            }
            if (obj?.texture?.dispose) obj.texture.dispose();
          });
        } catch {
          // ignore
        }
      }

      if (haloPoints) {
        try {
          haloGroup.remove(haloPoints);
        } catch {
          // ignore
        }
      }
      try {
        haloGeometry?.dispose();
        haloMaterial?.dispose();
      } catch {
        // ignore
      }
    };
  }, [
    modelUrl,
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
