"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, type VRM } from "@pixiv/three-vrm";

export type AvatarMode = "idle" | "listening" | "processing" | "speaking";

export type AvatarModelStatus = {
  loaded: boolean;
  error: string | null;
};

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
  // three-vrm typings are strict; runtime accepts string bone names.
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

export function AvatarModel(props: {
  modelUrl: string;
  mode: AvatarMode;
  speakingLevelRef: React.MutableRefObject<number>;
  listeningLevelRef: React.MutableRefObject<number>;
  cursorRef?: React.MutableRefObject<{ x: number; y: number }>;
  offset?: [number, number, number];
  onStatus?: (s: AvatarModelStatus) => void;
}) {
  const {
    modelUrl,
    mode,
    speakingLevelRef,
    listeningLevelRef,
    cursorRef,
    offset = [0.22, -0.02, 0],
    onStatus,
  } = props;

  const gltf = useLoader(GLTFLoader, modelUrl, (loader: GLTFLoader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  });

  const vrm = useMemo(() => {
    const loaded = (gltf as any)?.userData?.vrm as VRM | undefined;
    return loaded ?? null;
  }, [gltf]);

  const modeRef = useRef<AvatarMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const statusCbRef = useRef<typeof onStatus>(onStatus);
  useEffect(() => {
    statusCbRef.current = onStatus;
  }, [onStatus]);

  const vrmRef = useRef<VRM | null>(null);
  const rigRef = useRef<BoneRig | null>(null);
  const restRef = useRef<RestPose | null>(null);

  const nextBlinkAtRef = useRef(0);
  const blinkStartAtRef = useRef(0);
  const blinkingRef = useRef(false);

  const nextVowelAtRef = useRef(0);
  const vowelIndexRef = useRef(0);

  const haloGroupRef = useRef<THREE.Group | null>(null);
  const haloMaterialRef = useRef<THREE.PointsMaterial | null>(null);

  const visemes = useMemo(
    () =>
      [
        ["a", "aa"],
        ["i", "ih"],
        ["u", "ou"],
        ["e", "ee"],
        ["o", "oh"],
      ] as const,
    [],
  );

  const haloGeometry = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 0.72 + Math.random() * 0.1;

      const sinPhi = Math.sin(phi);
      const x = r * sinPhi * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * sinPhi * Math.sin(theta);

      const idx = i * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useEffect(() => {
    if (!vrm) {
      statusCbRef.current?.({ loaded: false, error: "VRM not found" });
      vrmRef.current = null;
      rigRef.current = null;
      restRef.current = null;
      return;
    }

    vrmRef.current = vrm;

    // Face the camera.
    vrm.scene.rotation.y = Math.PI;

    // Slightly offset for UI space.
    vrm.scene.position.set(offset[0], offset[1], offset[2]);

    // Prevent cumulative pose correction across remounts.
    const userData = (vrm as any).userData ?? ((vrm as any).userData = {});

    const rig: BoneRig = {
      hips: getBone(vrm, "hips"),
      spine: getBone(vrm, "spine"),
      chest: getBone(vrm, "chest"),
      neck: getBone(vrm, "neck"),
      head: getBone(vrm, "head"),
      rightUpperArm: getBone(vrm, "rightUpperArm"),
      leftUpperArm: getBone(vrm, "leftUpperArm"),
    };

    const rest: RestPose = {
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

    if (!userData.__uniflowPoseCorrected) {
      // Pose correction: VRM often loads in T-pose. Nudge toward a relaxed A-pose.
      const ARM_DOWN = 1.15;
      const ARM_FORWARD = 0.08;
      const ARM_YAW = 0.08;

      rest.rightUpperArm.z -= ARM_DOWN;
      rest.leftUpperArm.z += ARM_DOWN;
      rest.rightUpperArm.x += ARM_FORWARD;
      rest.leftUpperArm.x += ARM_FORWARD;
      rest.rightUpperArm.y += ARM_YAW;
      rest.leftUpperArm.y -= ARM_YAW;

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

      userData.__uniflowPoseCorrected = true;
    }

    rigRef.current = rig;
    restRef.current = rest;

    // Reset blink/lipsync schedule.
    nextBlinkAtRef.current = 0;
    blinkingRef.current = false;
    nextVowelAtRef.current = 0;
    vowelIndexRef.current = 0;

    statusCbRef.current?.({ loaded: true, error: null });

    return () => {
      vrmRef.current = null;
      rigRef.current = null;
      restRef.current = null;
    };
  }, [offset, vrm]);

  const updateBlink = (t: number) => {
    const currentVrm = vrmRef.current;
    if (!currentVrm) return;

    if (!nextBlinkAtRef.current) {
      nextBlinkAtRef.current = t + 2 + Math.random() * 4;
    }

    if (!blinkingRef.current && t >= nextBlinkAtRef.current) {
      blinkingRef.current = true;
      blinkStartAtRef.current = t;
    }

    if (!blinkingRef.current) return;

    const duration = 0.22;
    const p = (t - blinkStartAtRef.current) / duration;
    if (p >= 1) {
      blinkingRef.current = false;
      nextBlinkAtRef.current = t + 2 + Math.random() * 4;
      safeSetExpression(currentVrm, "blink", 0);
      return;
    }

    const v = p < 0.5 ? p * 2 : (1 - p) * 2;
    safeSetExpression(currentVrm, "blink", v);
  };

  const updateLipSync = (t: number, speak: number) => {
    const currentVrm = vrmRef.current;
    if (!currentVrm) return;

    const speaking = modeRef.current === "speaking";

    // Reset when not speaking.
    if (!speaking || speak < 0.02) {
      for (const [vrm0, vrm1] of visemes) {
        safeSetExpression(currentVrm, vrm0, 0);
        safeSetExpression(currentVrm, vrm1, 0);
      }
      return;
    }

    // Pick a vowel every ~120-220ms for basic realism.
    if (!nextVowelAtRef.current) {
      nextVowelAtRef.current = t + 0.12;
    }

    if (t >= nextVowelAtRef.current) {
      vowelIndexRef.current = (vowelIndexRef.current + 1) % visemes.length;
      nextVowelAtRef.current = t + 0.12 + Math.random() * 0.1;
    }

    const mouth = clamp01(0.05 + speak * 1.55);
    for (const [vrm0, vrm1] of visemes) {
      safeSetExpression(currentVrm, vrm0, 0);
      safeSetExpression(currentVrm, vrm1, 0);
    }

    const [vrm0, vrm1] = visemes[vowelIndexRef.current];
    safeSetExpression(currentVrm, vrm0, mouth);
    safeSetExpression(currentVrm, vrm1, mouth);
  };

  const applyPose = (t: number, speak: number, listen: number) => {
    const rig = rigRef.current;
    const rest = restRef.current;
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

    const cursor = cursorRef?.current ?? { x: 0, y: 0 };
    const cursorStrength = 0.22;

    const headTarget = {
      x:
        rest.head.x +
        headSwayX +
        talkBob +
        listenNod +
        (processing ? -0.08 : 0) +
        -cursor.y * cursorStrength * 0.25,
      y:
        rest.head.y +
        headSwayY +
        (processing ? 0.08 : 0) +
        cursor.x * cursorStrength,
      z: rest.head.z + headSwayZ + (processing ? 0.12 : 0),
    };

    const neckTarget = {
      x:
        rest.neck.x +
        headSwayX * 0.35 +
        talkBob * 0.4 +
        listenNod * 0.35 +
        (processing ? -0.05 : 0) +
        -cursor.y * cursorStrength * 0.12,
      y: rest.neck.y + headSwayY * 0.35 + cursor.x * cursorStrength * 0.35,
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
      x: rest.leftUpperArm.x + (processing ? 0.1 : 0) - gestureB + 0.05 * speak,
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
      rig.chest.rotation.x = lerp(rig.chest.rotation.x, chestTarget.x, smooth);
      rig.chest.rotation.y = lerp(rig.chest.rotation.y, chestTarget.y, smooth);
      rig.chest.rotation.z = lerp(rig.chest.rotation.z, chestTarget.z, smooth);
    }
    if (rig.spine) {
      rig.spine.rotation.x = lerp(rig.spine.rotation.x, spineTarget.x, smooth);
      rig.spine.rotation.y = lerp(rig.spine.rotation.y, spineTarget.y, smooth);
      rig.spine.rotation.z = lerp(rig.spine.rotation.z, spineTarget.z, smooth);
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

  useFrame((state, delta) => {
    const currentVrm = vrmRef.current;
    if (!currentVrm) return;

    const t = state.clock.getElapsedTime();

    const speak = clamp01(speakingLevelRef.current);
    const listen = clamp01(listeningLevelRef.current);
    const activity = Math.max(speak, listen * 0.85);

    const haloGroup = haloGroupRef.current;
    if (haloGroup) {
      haloGroup.rotation.y += delta * 0.25;
      const haloScale = 1 + activity * 0.12;
      haloGroup.scale.setScalar(haloScale);
    }

    const haloMaterial = haloMaterialRef.current;
    if (haloMaterial) {
      haloMaterial.opacity = 0.16 + activity * 0.38;
    }

    updateBlink(t);
    updateLipSync(t, speak);
    applyPose(t, speak, listen);

    try {
      currentVrm.update(delta);
    } catch {
      // ignore
    }
  });

  if (!vrm) return null;

  return (
    <>
      <group ref={haloGroupRef} position={[0.05 + offset[0], 1.26, -0.6]}>
        <points geometry={haloGeometry}>
          <pointsMaterial
            ref={(m) => {
              haloMaterialRef.current = m;
            }}
            color={0xffffff}
            size={0.012}
            sizeAttenuation
            transparent
            opacity={0.22}
            depthWrite={false}
          />
        </points>
      </group>
      <primitive object={vrm.scene} dispose={null} />
    </>
  );
}
