"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";

import { createVrmLipSync, type VrmLipSyncController } from "./VrmLipSync";

export type ThreeDLeiaMode = "idle" | "listening" | "processing" | "speaking";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type BoneKey =
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "rightUpperArm"
  | "leftUpperArm";

type BoneRig = Record<BoneKey, THREE.Object3D | null>;

type RestPose = Record<BoneKey, { x: number; y: number; z: number }>;

function getBone(vrm: VRM, name: BoneKey) {
  // three-vrm typings are strict; the runtime accepts the string bone names.
  const humanoid = (vrm as any)?.humanoid;
  if (!humanoid) return null;
  return humanoid.getNormalizedBoneNode(name) as THREE.Object3D | null;
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
      minLevel: 0.02,
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

    const createHalo = () => {
      // Disc-like nebula behind the avatar (no particles in front of the mesh).
      const count = 1100;
      const positions = new Float32Array(count * 3);

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
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
      }

      haloGeometry = new THREE.BufferGeometry();
      haloGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );

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
    let rig: BoneRig | null = null;
    let rest: RestPose | null = null;

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

    (async () => {
      try {
        const gltf = await loader.loadAsync(modelUrl);
        if (!mounted) return;

        const loaded = (gltf as any)?.userData?.vrm as VRM | undefined;
        if (!loaded) {
          throw new Error("VRM not found in glTF userData");
        }

        vrm = loaded;

        // Face the camera.
        vrm.scene.rotation.y = Math.PI;

        // Slightly lower the model to center it.
        vrm.scene.position.set(0, -0.02, 0);

        scene.add(vrm.scene);

        rig = {
          hips: getBone(vrm, "hips"),
          spine: getBone(vrm, "spine"),
          chest: getBone(vrm, "chest"),
          neck: getBone(vrm, "neck"),
          head: getBone(vrm, "head"),
          rightUpperArm: getBone(vrm, "rightUpperArm"),
          leftUpperArm: getBone(vrm, "leftUpperArm"),
        };

        rest = {
          hips: {
            x: rig.hips?.rotation.x ?? 0,
            y: rig.hips?.rotation.y ?? 0,
            z: rig.hips?.rotation.z ?? 0,
          },
          spine: {
            x: rig.spine?.rotation.x ?? 0,
            y: rig.spine?.rotation.y ?? 0,
            z: rig.spine?.rotation.z ?? 0,
          },
          chest: {
            x: rig.chest?.rotation.x ?? 0,
            y: rig.chest?.rotation.y ?? 0,
            z: rig.chest?.rotation.z ?? 0,
          },
          neck: {
            x: rig.neck?.rotation.x ?? 0,
            y: rig.neck?.rotation.y ?? 0,
            z: rig.neck?.rotation.z ?? 0,
          },
          head: {
            x: rig.head?.rotation.x ?? 0,
            y: rig.head?.rotation.y ?? 0,
            z: rig.head?.rotation.z ?? 0,
          },
          rightUpperArm: {
            x: rig.rightUpperArm?.rotation.x ?? 0,
            y: rig.rightUpperArm?.rotation.y ?? 0,
            z: rig.rightUpperArm?.rotation.z ?? 0,
          },
          leftUpperArm: {
            x: rig.leftUpperArm?.rotation.x ?? 0,
            y: rig.leftUpperArm?.rotation.y ?? 0,
            z: rig.leftUpperArm?.rotation.z ?? 0,
          },
        };

        // Pose correction: nudge toward a relaxed A-pose.
        const ARM_DOWN = 1.15;
        const ARM_FORWARD = 0.08;
        const ARM_YAW = 0.08;

        rest.rightUpperArm.z -= ARM_DOWN;
        rest.leftUpperArm.z += ARM_DOWN;
        rest.rightUpperArm.x += ARM_FORWARD;
        rest.leftUpperArm.x += ARM_FORWARD;
        rest.rightUpperArm.y += ARM_YAW;
        rest.leftUpperArm.y -= ARM_YAW;

        // Apply immediately so the first frame isn't a T-pose.
        if (rig.rightUpperArm) {
          rig.rightUpperArm.rotation.set(
            rest.rightUpperArm.x,
            rest.rightUpperArm.y,
            rest.rightUpperArm.z,
          );
        }
        if (rig.leftUpperArm) {
          rig.leftUpperArm.rotation.set(
            rest.leftUpperArm.x,
            rest.leftUpperArm.y,
            rest.leftUpperArm.z,
          );
        }

        // Initialize blink schedule.
        const t = clock.getElapsedTime();
        nextBlinkAtRef.v = t + 2 + Math.random() * 4;
        // initialize lip sync
        lipSync = createVrmLipSync(vrm, lipSyncOptions);

        setStatus({ loaded: true, error: null });
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

    const applyPose = (t: number, speak: number, listen: number) => {
      if (!rig || !rest) return;

      const m = modeRef.current;

      const speaking = m === "speaking";
      const listening = m === "listening";
      const processing = m === "processing";

      const breath1 = Math.sin(t * 1.15) * 0.012;
      const breath2 = Math.sin(t * 1.15 + 0.45) * 0.008;

      const headSwayY = Math.sin(t * 0.42) * 0.022;
      const headSwayZ = Math.sin(t * 0.25) * 0.014;
      const headSwayX = Math.sin(t * 0.3) * 0.009;

      const talkBob = speaking ? Math.sin(t * 6.0) * 0.03 * speak : 0;
      const listenNod = listening ? Math.sin(t * 4.5) * 0.02 * listen : 0;

      const headTarget = {
        x:
          rest.head.x +
          headSwayX +
          talkBob +
          listenNod +
          (processing ? -0.08 : 0),
        y: rest.head.y + headSwayY + (processing ? 0.08 : 0),
        z: rest.head.z + headSwayZ + (processing ? 0.12 : 0),
      };

      const neckTarget = {
        x:
          rest.neck.x +
          headSwayX * 0.35 +
          talkBob * 0.4 +
          listenNod * 0.35 +
          (processing ? -0.05 : 0),
        y: rest.neck.y + headSwayY * 0.35,
        z: rest.neck.z + (processing ? 0.05 : 0),
      };

      const chestTarget = {
        x: rest.chest.x + breath1 + (speaking ? 0.01 * speak : 0),
        y: rest.chest.y,
        z: rest.chest.z,
      };

      const spineTarget = {
        x: rest.spine.x + breath2,
        y: rest.spine.y,
        z: rest.spine.z,
      };

      const gestureA = speaking ? Math.sin(t * 2.2) * 0.11 * speak : 0;
      const gestureB = speaking ? Math.sin(t * 3.4 + 1.1) * 0.07 * speak : 0;
      const armRaise = speaking
        ? 0.22 * speak
        : listening
          ? 0.05 * listen
          : processing
            ? 0.08
            : 0;

      const rightUpperArmTarget = {
        x:
          rest.rightUpperArm.x +
          (processing ? 0.12 : 0) +
          gestureB +
          0.06 * speak,
        y: rest.rightUpperArm.y + (speaking ? -0.06 * speak : 0),
        z: rest.rightUpperArm.z + armRaise + gestureA,
      };

      const leftUpperArmTarget = {
        x:
          rest.leftUpperArm.x +
          (processing ? 0.1 : 0) -
          gestureB +
          0.05 * speak,
        y: rest.leftUpperArm.y + (speaking ? 0.06 * speak : 0),
        z: rest.leftUpperArm.z - armRaise - gestureA,
      };

      const smooth = 0.08;

      if (rig.head) {
        rig.head.rotation.x = lerp(rig.head.rotation.x, headTarget.x, smooth);
        rig.head.rotation.y = lerp(rig.head.rotation.y, headTarget.y, smooth);
        rig.head.rotation.z = lerp(rig.head.rotation.z, headTarget.z, smooth);
      }
      if (rig.neck) {
        rig.neck.rotation.x = lerp(rig.neck.rotation.x, neckTarget.x, smooth);
        rig.neck.rotation.y = lerp(rig.neck.rotation.y, neckTarget.y, smooth);
        rig.neck.rotation.z = lerp(rig.neck.rotation.z, neckTarget.z, smooth);
      }
      if (rig.chest) {
        rig.chest.rotation.x = lerp(
          rig.chest.rotation.x,
          chestTarget.x,
          smooth,
        );
        rig.chest.rotation.y = lerp(
          rig.chest.rotation.y,
          chestTarget.y,
          smooth,
        );
        rig.chest.rotation.z = lerp(
          rig.chest.rotation.z,
          chestTarget.z,
          smooth,
        );
      }
      if (rig.spine) {
        rig.spine.rotation.x = lerp(
          rig.spine.rotation.x,
          spineTarget.x,
          smooth,
        );
        rig.spine.rotation.y = lerp(
          rig.spine.rotation.y,
          spineTarget.y,
          smooth,
        );
        rig.spine.rotation.z = lerp(
          rig.spine.rotation.z,
          spineTarget.z,
          smooth,
        );
      }
      if (rig.rightUpperArm) {
        rig.rightUpperArm.rotation.x = lerp(
          rig.rightUpperArm.rotation.x,
          rightUpperArmTarget.x,
          smooth,
        );
        rig.rightUpperArm.rotation.y = lerp(
          rig.rightUpperArm.rotation.y,
          rightUpperArmTarget.y,
          smooth,
        );
        rig.rightUpperArm.rotation.z = lerp(
          rig.rightUpperArm.rotation.z,
          rightUpperArmTarget.z,
          smooth,
        );
      }
      if (rig.leftUpperArm) {
        rig.leftUpperArm.rotation.x = lerp(
          rig.leftUpperArm.rotation.x,
          leftUpperArmTarget.x,
          smooth,
        );
        rig.leftUpperArm.rotation.y = lerp(
          rig.leftUpperArm.rotation.y,
          leftUpperArmTarget.y,
          smooth,
        );
        rig.leftUpperArm.rotation.z = lerp(
          rig.leftUpperArm.rotation.z,
          leftUpperArmTarget.z,
          smooth,
        );
      }
    };

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

      if (vrm) {
        const speak = clamp01(speakingLevelRef.current);
        const listen = clamp01(listeningLevelRef.current);

        const activity = Math.max(speak, listen * 0.85);
        haloGroup.rotation.y += delta * 0.18;
        haloGroup.rotation.z = Math.sin(t * 0.12) * 0.06;
        const haloScale = 1 + activity * 0.12;
        haloGroup.scale.setScalar(haloScale);
        if (haloMaterial) {
          haloMaterial.opacity = 0.14 + activity * 0.34;
        }

        updateBlink(t);

        const m = modeRef.current;
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
        applyPose(t, speak, listen);

        try {
          vrm.update(delta);
        } catch {
          // ignore
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
