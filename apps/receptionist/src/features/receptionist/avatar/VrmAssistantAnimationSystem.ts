import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

import type { VRM } from "@pixiv/three-vrm";

export const STATES = {
  IDLE: "idle",
  THINKING: "thinking",
  TALKING: "talking",
} as const;

export type AssistantAnimState = (typeof STATES)[keyof typeof STATES];

type LoadedClip = {
  clip: THREE.AnimationClip;
  url: string;
  sourceRoot: THREE.Object3D | null;
  sourceSkinnedMesh: THREE.SkinnedMesh | null;
};

export type AssistantAnimationSystem = {
  mixer: THREE.AnimationMixer;
  actions: Record<AssistantAnimState, THREE.AnimationAction>;
  getCurrentState: () => AssistantAnimState;
  setState: (next: AssistantAnimState) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
  debug: {
    clips: Partial<Record<AssistantAnimState, string>>;
  };
};

function findFirstSkinnedMesh(
  root: THREE.Object3D | null | undefined,
): THREE.SkinnedMesh | null {
  if (!root) return null;
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((obj: any) => {
    if (found) return;
    if (obj && obj.isSkinnedMesh) found = obj as THREE.SkinnedMesh;
  });
  return found;
}

function collectBones(root: THREE.Object3D | null | undefined): THREE.Bone[] {
  if (!root) return [];
  const out: THREE.Bone[] = [];
  root.traverse((obj: any) => {
    if (obj && obj.isBone) out.push(obj as THREE.Bone);
  });
  return out;
}

function normalizeBoneName(name: string): string {
  let s = String(name ?? "").toLowerCase();
  s = s.replace(/mixamorig/gi, "");
  s = s.replace(/mixamo/gi, "");
  s = s.replace(/j_bip/gi, "");
  s = s.replace(/bip001/gi, "");
  s = s.replace(/bip/gi, "");
  s = s.replace(/armature/gi, "");

  // Normalize L/R markers.
  s = s.replace(/left/gi, "l");
  s = s.replace(/right/gi, "r");

  // Remove common center marker tokens (e.g. J_Bip_C_Hips -> hips).
  // Only removes standalone "c" tokens separated by non-alphanumerics.
  s = s.replace(/(^|[^a-z0-9])c(?=[^a-z0-9])/gi, "$1");

  // Common Mixamo↔VRM naming differences.
  s = s.replace(/upperarm/gi, "arm");
  s = s.replace(/lowerarm/gi, "forearm");
  s = s.replace(/upperleg/gi, "upleg");
  s = s.replace(/lowerleg/gi, "leg");

  // Remove separators.
  s = s.replace(/[^a-z0-9]/g, "");
  return s;
}

function buildAutoBoneMap(
  targetBones: THREE.Bone[],
  sourceBones: THREE.Bone[],
): Record<string, string> {
  const sourceByKey = new Map<string, string>();
  for (const b of sourceBones) {
    const key = normalizeBoneName(b.name);
    if (!key) continue;
    if (!sourceByKey.has(key)) sourceByKey.set(key, b.name);
  }

  const names: Record<string, string> = {};
  for (const tb of targetBones) {
    const key = normalizeBoneName(tb.name);
    if (!key) continue;
    const src = sourceByKey.get(key);
    if (src) names[tb.name] = src;
  }

  return names;
}

function guessSourceHipBoneName(sourceBones: THREE.Bone[]): string | null {
  for (const b of sourceBones) {
    const key = normalizeBoneName(b.name);
    if (key === "hips" || key.endsWith("hips")) return b.name;
  }
  // fallback: something containing hip/hips
  for (const b of sourceBones) {
    const n = String(b.name ?? "").toLowerCase();
    if (n.includes("hips") || n.includes("hip")) return b.name;
  }
  return null;
}

function getRawBoneNode(vrm: VRM, boneName: string): THREE.Object3D | null {
  const humanoid = (vrm as any)?.humanoid;
  if (!humanoid) return null;
  try {
    return humanoid.getRawBoneNode(boneName) as THREE.Object3D | null;
  } catch {
    return null;
  }
}

function nodeNameForTrack(node: THREE.Object3D) {
  return node.name && node.name.trim().length > 0 ? node.name : node.uuid;
}

function createBreathingIdleClip(vrm: VRM): THREE.AnimationClip {
  const spine = getRawBoneNode(vrm, "spine");
  const chest = getRawBoneNode(vrm, "chest");
  const head = getRawBoneNode(vrm, "head");

  const tracks: THREE.KeyframeTrack[] = [];
  const duration = 4.6;
  const times = new Float32Array([0, duration * 0.5, duration]);

  if (chest) {
    const base = chest.rotation.x;
    const values = new Float32Array([base, base + 0.018, base]);
    tracks.push(
      new THREE.NumberKeyframeTrack(
        `${nodeNameForTrack(chest)}.rotation[x]`,
        times,
        values,
      ),
    );
  }

  if (spine) {
    const base = spine.rotation.x;
    const values = new Float32Array([base, base + 0.012, base]);
    tracks.push(
      new THREE.NumberKeyframeTrack(
        `${nodeNameForTrack(spine)}.rotation[x]`,
        times,
        values,
      ),
    );
  }

  // If we couldn't find the intended bones, animate the whole scene subtly.
  if (tracks.length === 0) {
    const fallback =
      head ?? getRawBoneNode(vrm, "neck") ?? collectBones(vrm.scene)[0] ?? null;

    if (fallback) {
      const base = fallback.rotation.x;
      const values = new Float32Array([base, base + 0.02, base]);
      tracks.push(
        new THREE.NumberKeyframeTrack(
          `${nodeNameForTrack(fallback)}.rotation[x]`,
          times,
          values,
        ),
      );
    }
  }

  const clip = new THREE.AnimationClip("idle_breath", duration, tracks);
  clip.resetDuration();
  return clip;
}

async function loadClipFromUrl(url: string): Promise<LoadedClip> {
  const lower = url.toLowerCase();

  if (lower.endsWith(".fbx")) {
    const loader = new FBXLoader();
    const root = await loader.loadAsync(url);
    const clip = root.animations?.[0];
    if (!clip) throw new Error(`No animations found in ${url}`);
    return {
      clip,
      url,
      sourceRoot: root,
      sourceSkinnedMesh: findFirstSkinnedMesh(root),
    };
  }

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const clip = gltf.animations?.[0];
  if (!clip) throw new Error(`No animations found in ${url}`);
  return {
    clip,
    url,
    sourceRoot: gltf.scene,
    sourceSkinnedMesh: findFirstSkinnedMesh(gltf.scene),
  };
}

async function loadFirstAvailableClip(
  candidates: string[],
): Promise<LoadedClip | null> {
  for (const url of candidates) {
    try {
      return await loadClipFromUrl(url);
    } catch {
      // try next candidate
    }
  }
  return null;
}

function maybeRetargetClip(params: {
  mixerRoot: THREE.Object3D;
  loaded: LoadedClip;
  targetRoot: THREE.Object3D;
  targetBones: THREE.Bone[];
}): THREE.AnimationClip {
  const { mixerRoot, loaded, targetRoot, targetBones } = params;

  if (!targetBones || targetBones.length === 0) return loaded.clip;

  // Required for clips that use .bones[...].quaternion bindings.
  (mixerRoot as any).bones = targetBones;

  // SkeletonUtils.retarget / retargetClip expects target.skeleton.pose().
  // VRM normalized rig root is just an Object3D, so we attach a Skeleton.
  const targetAny = targetRoot as any;
  const existingSkel = targetAny?.skeleton;
  const hasBonesArray = Boolean(
    existingSkel?.bones && Array.isArray(existingSkel.bones),
  );
  if (!hasBonesArray) {
    try {
      targetAny.skeleton = new THREE.Skeleton(targetBones);
    } catch {
      // ignore
    }
  }

  const sourceMesh = loaded.sourceSkinnedMesh;
  const sourceRoot = loaded.sourceRoot;
  const sourceBones =
    (sourceMesh?.skeleton?.bones?.length
      ? (sourceMesh.skeleton.bones as THREE.Bone[])
      : collectBones(sourceRoot)) ?? [];

  if (!sourceBones || sourceBones.length === 0) return loaded.clip;

  // Some FBX files are "skeleton only" (no mesh). For those, we attach a Skeleton and
  // a `.bones` array to the loaded root so both retargeting and animation binding work.
  let sourceForRetarget: any = sourceMesh;
  if (!sourceForRetarget && sourceRoot) {
    const srcAny = sourceRoot as any;
    try {
      if (!srcAny?.skeleton || !Array.isArray(srcAny.skeleton?.bones)) {
        srcAny.skeleton = new THREE.Skeleton(sourceBones);
      }
    } catch {
      // ignore
    }
    try {
      srcAny.bones = sourceBones;
    } catch {
      // ignore
    }
    sourceForRetarget = sourceRoot;
  }

  if (!sourceForRetarget) {
    try {
      sourceForRetarget = new THREE.Skeleton(sourceBones);
    } catch {
      return loaded.clip;
    }
  }

  const names = buildAutoBoneMap(targetBones, sourceBones);
  const hip = guessSourceHipBoneName(sourceBones) ?? "hip";

  try {
    const converted = SkeletonUtils.retargetClip(
      targetRoot as any,
      sourceForRetarget,
      loaded.clip,
      {
        names,
        hip,
      },
    );
    converted.name = `${loaded.clip.name || "clip"}_retargeted`;
    return converted;
  } catch {
    return loaded.clip;
  }
}

function configureLoopingAction(action: THREE.AnimationAction) {
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
}

function sanitizeAssistantClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  // Keep rotations/quaternions, but strip translations/scales that can
  // throw the avatar out of frame (FBX/GLB often contain huge hip/root motion).
  const safeTracks = clip.tracks.filter((t) => {
    const name = String((t as any)?.name ?? "");
    const n = name.toLowerCase();

    const isRotationLike = n.includes(".rotation") || n.includes(".quaternion");

    const extractNodeKey = (): string => {
      // Common bindings:
      // - ".bones[Hips].quaternion"
      // - "mixamorigHips.quaternion"
      // - "Hips.rotation[x]"
      if (n.startsWith(".bones[")) {
        const close = n.indexOf("]");
        if (close > 7) return n.slice(7, close);
      }
      const dot = n.indexOf(".");
      if (dot > 0) return n.slice(0, dot);
      return "";
    };

    const nodeKey = isRotationLike ? extractNodeKey() : "";

    // Remove all position/scale tracks (includes hips/root motion).
    if (n.includes(".position") || n.includes(".scale")) return false;

    // Remove root rotation tracks (but keep bone tracks like .bones[...]).
    const isRootTrack = name.startsWith(".") && !name.startsWith(".bones[");
    if (isRootTrack && (n.includes(".rotation") || n.includes(".quaternion"))) {
      return false;
    }

    // Mixamo and some FBX/GLB clips often include a "Hips" rotation that yaws
    // the entire character (effectively fighting our fixed facing direction).
    // Strip that track so the avatar stays facing forward.
    if (
      isRotationLike &&
      (nodeKey === "hip" ||
        nodeKey.endsWith("hips") ||
        n.includes("hips.rotation"))
    ) {
      return false;
    }

    return true;
  });

  if (safeTracks.length === clip.tracks.length) return clip;

  const sanitized = new THREE.AnimationClip(
    `${clip.name || "clip"}_sanitized`,
    clip.duration,
    safeTracks,
  );
  sanitized.resetDuration();
  return sanitized;
}

export async function createAssistantAnimationSystem(params: {
  vrm: VRM;
  mixerRoot: THREE.Object3D;
  animationsBasePath?: string;
  fadeSeconds?: number;
  minThinkingMs?: number;
}): Promise<AssistantAnimationSystem> {
  const {
    vrm,
    mixerRoot,
    animationsBasePath = "/animations",
    fadeSeconds = 0.4,
    minThinkingMs = 700,
  } = params;

  const debugClips: Partial<Record<AssistantAnimState, string>> = {};

  // We animate the RAW skeleton (SkinnedMesh bones). The VRM normalized rig is
  // just a set of Object3D nodes that *drive* the raw bones when
  // humanoid.autoUpdateHumanBones is enabled.
  //
  // Retargeting via SkeletonUtils.retargetClip mutates the target skeleton
  // during conversion, so we retarget onto a detached clone to avoid the
  // "1-second snap" when clips finish loading.
  const liveTargetMesh = findFirstSkinnedMesh(vrm.scene);
  const liveTargetBones = ((liveTargetMesh as any)?.skeleton?.bones ??
    []) as THREE.Bone[];

  const bindingBones =
    liveTargetBones.length > 0 ? liveTargetBones : collectBones(vrm.scene);

  // Required for clips that use .bones[...].quaternion bindings.
  try {
    (mixerRoot as any).bones = bindingBones;
  } catch {
    // ignore
  }

  // Create a detached clone for retargeting so we don't mutate the live avatar.
  let retargetTargetRoot: THREE.Object3D = liveTargetMesh ?? mixerRoot;
  try {
    const clonedScene = SkeletonUtils.clone(vrm.scene);
    const clonedMesh = findFirstSkinnedMesh(clonedScene);
    if (clonedMesh) {
      clonedScene.updateMatrixWorld(true);
      try {
        clonedMesh.skeleton.pose();
      } catch {
        // ignore
      }
      clonedScene.updateMatrixWorld(true);
      retargetTargetRoot = clonedMesh;
    }
  } catch {
    // ignore
  }

  const [idleLoaded, thinkingLoaded, talkingLoaded] = await Promise.all([
    // Use ONLY the explicitly provided filenames.
    loadFirstAvailableClip([`${animationsBasePath}/idle.fbx`]),
    loadFirstAvailableClip([`${animationsBasePath}/Thinking.fbx`]),
    // Repo currently contains talkingloop.glb; prefer talkingloop.fbx if/when added.
    loadFirstAvailableClip([`${animationsBasePath}/talkingloop.glb`]),
  ]);

  const targetRoot: THREE.Object3D = retargetTargetRoot;
  const targetBones = bindingBones;

  const idleClip = idleLoaded
    ? ((debugClips[STATES.IDLE] = idleLoaded.url),
      maybeRetargetClip({
        mixerRoot,
        loaded: idleLoaded,
        targetRoot,
        targetBones,
      }))
    : ((debugClips[STATES.IDLE] = "(procedural)"),
      createBreathingIdleClip(vrm));

  const thinkingClip = thinkingLoaded
    ? ((debugClips[STATES.THINKING] = thinkingLoaded.url),
      maybeRetargetClip({
        mixerRoot,
        loaded: thinkingLoaded,
        targetRoot,
        targetBones,
      }))
    : idleClip;

  const talkingClip = talkingLoaded
    ? ((debugClips[STATES.TALKING] = talkingLoaded.url),
      maybeRetargetClip({
        mixerRoot,
        loaded: talkingLoaded,
        targetRoot,
        targetBones,
      }))
    : idleClip;

  const finalIdleClip = sanitizeAssistantClip(idleClip);
  const finalThinkingClip = sanitizeAssistantClip(thinkingClip);
  const finalTalkingClip = sanitizeAssistantClip(talkingClip);

  const mixer = new THREE.AnimationMixer(mixerRoot);

  const actions: Record<AssistantAnimState, THREE.AnimationAction> = {
    idle: mixer.clipAction(finalIdleClip),
    thinking: mixer.clipAction(finalThinkingClip),
    talking: mixer.clipAction(finalTalkingClip),
  };

  configureLoopingAction(actions.idle);
  configureLoopingAction(actions.thinking);
  configureLoopingAction(actions.talking);

  let currentState: AssistantAnimState = STATES.IDLE;
  let currentAction: THREE.AnimationAction | null = null;
  let thinkingStartedAtMs = 0;
  let pendingTimer: number | null = null;
  let pendingTo: AssistantAnimState | null = null;

  const clearPending = () => {
    if (pendingTimer != null) {
      try {
        window.clearTimeout(pendingTimer);
      } catch {
        // ignore
      }
    }
    pendingTimer = null;
    pendingTo = null;
  };

  const transitionTo = (next: AssistantAnimState) => {
    clearPending();
    if (next === currentState) return;

    const nextAction = actions[next];

    const nowMs =
      typeof performance === "undefined" ? Date.now() : performance.now();
    if (next === STATES.THINKING) {
      thinkingStartedAtMs = nowMs;
    }

    nextAction.reset();
    nextAction.play();

    if (currentAction && currentAction !== nextAction) {
      nextAction.crossFadeFrom(currentAction, fadeSeconds, true);
      currentAction.fadeOut(fadeSeconds);
    } else if (!currentAction) {
      nextAction.fadeIn(fadeSeconds);
    }

    currentAction = nextAction;
    currentState = next;
  };

  const setState = (next: AssistantAnimState) => {
    if (next === currentState) return;

    const nowMs =
      typeof performance === "undefined" ? Date.now() : performance.now();

    // Ensure THINKING is visible even for very fast responses.
    if (
      next === STATES.TALKING &&
      currentState === STATES.THINKING &&
      nowMs - thinkingStartedAtMs < minThinkingMs
    ) {
      clearPending();
      pendingTo = STATES.TALKING;
      const wait = Math.max(0, minThinkingMs - (nowMs - thinkingStartedAtMs));
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;
        if (pendingTo) transitionTo(pendingTo);
      }, wait);
      return;
    }

    transitionTo(next);
  };

  // Start in IDLE.
  actions.idle.reset();
  actions.idle.play();
  currentAction = actions.idle;

  return {
    mixer,
    actions,
    getCurrentState: () => currentState,
    setState,
    update: (deltaSeconds: number) => {
      mixer.update(Math.max(0, deltaSeconds));
    },
    dispose: () => {
      clearPending();
      try {
        Object.values(actions).forEach((a) => a.stop());
      } catch {
        // ignore
      }
      try {
        mixer.stopAllAction();
      } catch {
        // ignore
      }
      try {
        mixer.uncacheRoot(mixerRoot);
      } catch {
        // ignore
      }
    },
    debug: { clips: debugClips },
  };
}
