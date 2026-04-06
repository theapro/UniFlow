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
  debug: { clips: Partial<Record<AssistantAnimState, string>> };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findFirstSkinnedMesh(root: THREE.Object3D | null | undefined): THREE.SkinnedMesh | null {
  if (!root) return null;
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o: any) => {
    if (!found && o?.isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

function collectBones(root: THREE.Object3D | null | undefined): THREE.Bone[] {
  if (!root) return [];
  const out: THREE.Bone[] = [];
  root.traverse((o: any) => { if (o?.isBone) out.push(o as THREE.Bone); });
  return out;
}

function nodeId(node: THREE.Object3D): string {
  return node.name?.trim() ? node.name : node.uuid;
}

function normalizeBoneName(name: string): string {
  let s = name.toLowerCase();
  s = s.replace(/mixamorig[:\s]*/gi, "");
  s = s.replace(/mixamo/gi, "");
  s = s.replace(/j_bip_[clr]_/gi, "");
  s = s.replace(/j_bip/gi, "");
  s = s.replace(/bip001\s*/gi, "");
  s = s.replace(/bip\s*/gi, "");
  s = s.replace(/armature/gi, "");
  s = s.replace(/\bleft\b/gi, "l");
  s = s.replace(/\bright\b/gi, "r");
  s = s.replace(/_l$/gi, "l");
  s = s.replace(/_r$/gi, "r");
  s = s.replace(/upperarm/gi, "arm");
  s = s.replace(/lowerarm/gi, "forearm");
  s = s.replace(/upperleg/gi, "upleg");
  s = s.replace(/lowerleg/gi, "leg");
  s = s.replace(/thigh/gi, "upleg");
  s = s.replace(/calf/gi, "leg");
  s = s.replace(/[^a-z0-9]/g, "");
  return s;
}

function buildBoneMap(targetBones: THREE.Bone[], sourceBones: THREE.Bone[]): Record<string, string> {
  const srcMap = new Map<string, string>();
  for (const b of sourceBones) {
    const k = normalizeBoneName(b.name);
    if (k && !srcMap.has(k)) srcMap.set(k, b.name);
  }
  const names: Record<string, string> = {};
  for (const tb of targetBones) {
    const k = normalizeBoneName(tb.name);
    const src = k && srcMap.get(k);
    if (src) names[tb.name] = src;
  }
  return names;
}

function guessHipName(bones: THREE.Bone[]): string {
  for (const b of bones) {
    const k = normalizeBoneName(b.name);
    if (k === "hips" || k === "hip") return b.name;
  }
  for (const b of bones) {
    if (b.name.toLowerCase().includes("hip")) return b.name;
  }
  return "Hips";
}

function getRawBone(vrm: VRM, name: string): THREE.Object3D | null {
  try { return (vrm as any)?.humanoid?.getRawBoneNode(name) ?? null; }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rest-pose snapshot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture CURRENT bone quaternions into a constant AnimationClip.
 * Call this after arm-correction is applied so the pose is baked in.
 * The mixer will play this clip → avatar stays in the corrected pose
 * even when external clips fail.
 */
function buildRestPoseClip(bones: THREE.Bone[], duration = 2.0): THREE.AnimationClip {
  const tracks = bones.map((bone) => {
    const q = bone.quaternion;
    return new THREE.QuaternionKeyframeTrack(
      `${nodeId(bone)}.quaternion`,
      [0, duration],
      [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w],
    );
  });
  return new THREE.AnimationClip("__rest_pose__", duration, tracks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural idle (breathing on top of rest-pose)
// ─────────────────────────────────────────────────────────────────────────────

function buildBreathingClip(vrm: VRM, bones: THREE.Bone[]): THREE.AnimationClip {
  const DURATION = 4.6;
  const rest = buildRestPoseClip(bones, DURATION);

  const extras: THREE.KeyframeTrack[] = [];
  const times = [0, DURATION * 0.5, DURATION];

  const addBreath = (node: THREE.Object3D | null, deltaX: number) => {
    if (!node) return;
    const base = (node as THREE.Bone).quaternion.clone();
    const peak = base.clone().multiply(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(deltaX, 0, 0)),
    );
    extras.push(new THREE.QuaternionKeyframeTrack(
      `${nodeId(node)}.quaternion`,
      times,
      [base.x, base.y, base.z, base.w, peak.x, peak.y, peak.z, peak.w, base.x, base.y, base.z, base.w],
    ));
  };

  addBreath(getRawBone(vrm, "chest"), 0.018);
  addBreath(getRawBone(vrm, "spine"), 0.012);
  if (extras.length === 0) addBreath(getRawBone(vrm, "head"), 0.02);

  const extraNames = new Set(extras.map((t) => (t as any).name));
  const merged = [
    ...rest.tracks.filter((t) => !extraNames.has((t as any).name)),
    ...extras,
  ];

  const clip = new THREE.AnimationClip("__breathing_idle__", DURATION, merged);
  clip.resetDuration();
  return clip;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clip loading
// ─────────────────────────────────────────────────────────────────────────────

async function loadClip(url: string): Promise<LoadedClip> {
  if (url.toLowerCase().endsWith(".fbx")) {
    const root = await new FBXLoader().loadAsync(url);
    const clip = root.animations?.[0];
    if (!clip) throw new Error(`No animation in ${url}`);
    return { clip, url, sourceRoot: root, sourceSkinnedMesh: findFirstSkinnedMesh(root) };
  }
  const gltf = await new GLTFLoader().loadAsync(url);
  const clip = gltf.animations?.[0];
  if (!clip) throw new Error(`No animation in ${url}`);
  return { clip, url, sourceRoot: gltf.scene, sourceSkinnedMesh: findFirstSkinnedMesh(gltf.scene) };
}

async function loadFirst(candidates: string[]): Promise<LoadedClip | null> {
  for (const url of candidates) {
    try { return await loadClip(url); } catch { /* try next */ }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitise — strip position/scale/scene-root tracks
// ─────────────────────────────────────────────────────────────────────────────

function sanitize(clip: THREE.AnimationClip): THREE.AnimationClip {
  const safe = clip.tracks.filter((t) => {
    const n = String((t as any).name ?? "").toLowerCase();
    if (n.includes(".position") || n.includes(".scale")) return false;
    // bare scene-root tracks start with "." but not ".bones["
    const raw = String((t as any).name ?? "");
    if (raw.startsWith(".") && !raw.startsWith(".bones[")) return false;
    return true;
  });
  if (safe.length === clip.tracks.length) return clip;
  const out = new THREE.AnimationClip(`${clip.name}_s`, clip.duration, safe);
  out.resetDuration();
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate — ensure tracks resolve against the live scene
// ─────────────────────────────────────────────────────────────────────────────

function validate(clip: THREE.AnimationClip, root: THREE.Object3D): boolean {
  if (!clip.tracks.length) return false;
  const names = new Set<string>();
  root.traverse((o) => { if (o.name) names.add(o.name); names.add(o.uuid); });
  let ok = 0;
  for (const t of clip.tracks) {
    const raw = String((t as any).name ?? "");
    const dot = raw.indexOf(".");
    if (dot > 0 && names.has(raw.slice(0, dot))) ok++;
  }
  const ratio = ok / clip.tracks.length;
  if (ratio < 0.3) {
    console.warn(`[anim] "${clip.name}": only ${ok}/${clip.tracks.length} tracks resolve`);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retarget — onto a CLONED skeleton so skeleton.pose() never touches live bones
// ─────────────────────────────────────────────────────────────────────────────

function tryRetarget(params: {
  loaded: LoadedClip;
  liveRoot: THREE.Object3D;          // vrm.scene — used for validation only
  liveBones: THREE.Bone[];           // live bones — used for bone-map building
  clonedMesh: THREE.SkinnedMesh;    // detached clone — retarget writes here
  clonedBones: THREE.Bone[];
}): THREE.AnimationClip | null {
  const { loaded, liveRoot, liveBones, clonedMesh, clonedBones } = params;
  if (!clonedBones.length) return null;

  const srcMesh = loaded.sourceSkinnedMesh;
  const srcRoot = loaded.sourceRoot;
  const srcBones: THREE.Bone[] =
    srcMesh?.skeleton?.bones?.length
      ? (srcMesh.skeleton.bones as THREE.Bone[])
      : collectBones(srcRoot);

  if (!srcBones.length) return null;

  let srcObj: any = srcMesh;
  if (!srcObj && srcRoot) {
    const a = srcRoot as any;
    try { a.skeleton ??= new THREE.Skeleton(srcBones); a.bones = srcBones; } catch { /* */ }
    srcObj = srcRoot;
  }
  if (!srcObj) return null;

  // pose() on the CLONE only — live bones are untouched
  try { clonedMesh.skeleton.pose(); clonedMesh.updateMatrixWorld(true); } catch { /* */ }

  const names = buildBoneMap(clonedBones, srcBones);
  const mapped = Object.keys(names).length;
  if (mapped < 5) {
    console.warn(`[anim] Only ${mapped} bones mapped for "${loaded.url}" — skip`);
    return null;
  }

  const hip = guessHipName(srcBones);

  try {
    const raw = SkeletonUtils.retargetClip(clonedMesh as any, srcObj, loaded.clip, { names, hip });
    raw.name = `${loaded.clip.name}_rt`;

    // The retargeted clip references CLONED bone names. We need it to reference
    // LIVE bone names. Remap the track names: clonedBone.name → liveBone.name.
    // Both skeletons have the same bones in the same order.
    const cloneToLive = new Map<string, string>();
    clonedBones.forEach((cb, i) => {
      const lb = liveBones[i];
      if (lb) cloneToLive.set(nodeId(cb), nodeId(lb));
    });

    for (const track of raw.tracks) {
      const tname = String((track as any).name ?? "");
      const dot = tname.indexOf(".");
      if (dot > 0) {
        const boneId = tname.slice(0, dot);
        const prop   = tname.slice(dot);
        const mapped = cloneToLive.get(boneId);
        if (mapped) (track as any).name = mapped + prop;
      }
    }

    const clean = sanitize(raw);

    if (!validate(clean, liveRoot)) return null;

    console.log(`[anim] ✓ Retargeted "${loaded.url}": ${clean.tracks.length} tracks, ${mapped} bones`);
    return clean;
  } catch (e) {
    console.warn(`[anim] retargetClip failed for "${loaded.url}":`, e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

function looping(action: THREE.AnimationAction) {
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(1);
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

  // ── Live skeleton ──────────────────────────────────────────────────────────
  const liveMesh  = findFirstSkinnedMesh(vrm.scene);
  const liveBones: THREE.Bone[] =
    liveMesh?.skeleton?.bones?.length
      ? (liveMesh.skeleton.bones as THREE.Bone[])
      : collectBones(vrm.scene);

  // ── Detached clone for retargeting ────────────────────────────────────────
  // skeleton.pose() inside retargetClip must NOT touch live bones.
  // We clone the VRM scene, find the mesh clone, and retarget onto it.
  // Afterwards we remap track names back to the live bone names.
  let clonedMesh: THREE.SkinnedMesh | null = null;
  let clonedBones: THREE.Bone[] = [];

  try {
    const clonedScene = SkeletonUtils.clone(vrm.scene);
    clonedMesh  = findFirstSkinnedMesh(clonedScene);
    clonedBones = clonedMesh?.skeleton?.bones?.length
      ? (clonedMesh.skeleton.bones as THREE.Bone[])
      : collectBones(clonedScene);
    clonedScene.updateMatrixWorld(true);
  } catch (e) {
    console.warn("[anim] Could not clone VRM scene for retargeting:", e);
  }

  // ── Snapshot rest pose AFTER arm-correction (caller already applied it) ───
  // This is the fallback clip: keeps the avatar in the corrected A-pose.
  const restClip     = buildRestPoseClip(liveBones);
  const breathingClip = buildBreathingClip(vrm, liveBones);

  // ── Load external clips ───────────────────────────────────────────────────
  const [idleLoaded, thinkingLoaded, talkingLoaded] = await Promise.all([
    loadFirst([`${animationsBasePath}/idle.fbx`]),
    loadFirst([`${animationsBasePath}/Thinking.fbx`]),
    loadFirst([
      `${animationsBasePath}/talkingloop.fbx`,
      `${animationsBasePath}/talkingloop.glb`,
    ]),
  ]);

  // ── Resolve each clip ─────────────────────────────────────────────────────
  const resolve = (
    loaded: LoadedClip | null,
    fallback: THREE.AnimationClip,
    state: AssistantAnimState,
  ): THREE.AnimationClip => {
    if (loaded && clonedMesh) {
      const result = tryRetarget({
        loaded,
        liveRoot: vrm.scene,
        liveBones,
        clonedMesh,
        clonedBones,
      });
      if (result) {
        debugClips[state] = loaded.url;
        return result;
      }
    }
    debugClips[state] = loaded
      ? `(fallback — retarget failed: ${loaded.url})`
      : "(fallback — file not found)";
    return fallback;
  };

  const finalIdle    = resolve(idleLoaded,    breathingClip, STATES.IDLE);
  const finalThink   = resolve(thinkingLoaded, finalIdle,    STATES.THINKING);
  const finalTalk    = resolve(talkingLoaded,  finalIdle,    STATES.TALKING);

  console.log("[anim] ready:", debugClips);

  // ── Mixer + actions ───────────────────────────────────────────────────────
  const mixer = new THREE.AnimationMixer(mixerRoot);

  const actions: Record<AssistantAnimState, THREE.AnimationAction> = {
    idle:     mixer.clipAction(finalIdle),
    thinking: mixer.clipAction(finalThink),
    talking:  mixer.clipAction(finalTalk),
  };

  looping(actions.idle);
  looping(actions.thinking);
  looping(actions.talking);

  let current: AssistantAnimState = STATES.IDLE;
  let currentAction: THREE.AnimationAction | null = null;
  let thinkMs = 0;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingTo: AssistantAnimState | null = null;

  const clearPending = () => {
    if (pendingTimer != null) { try { clearTimeout(pendingTimer); } catch { /**/ } }
    pendingTimer = null; pendingTo = null;
  };

  const transitionTo = (next: AssistantAnimState) => {
    clearPending();
    if (next === current && currentAction?.isRunning()) return;
    const nextAction = actions[next];
    if (next === STATES.THINKING) thinkMs = performance?.now() ?? Date.now();
    nextAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
    if (currentAction && currentAction !== nextAction) {
      nextAction.crossFadeFrom(currentAction, fadeSeconds, true);
    } else if (!currentAction) {
      nextAction.fadeIn(fadeSeconds);
    }
    currentAction = nextAction;
    current = next;
  };

  const setState = (next: AssistantAnimState) => {
    if (next === current && currentAction?.isRunning()) return;
    const now = performance?.now() ?? Date.now();
    if (next === STATES.TALKING && current === STATES.THINKING && now - thinkMs < minThinkingMs) {
      clearPending();
      pendingTo = STATES.TALKING;
      pendingTimer = setTimeout(() => { pendingTimer = null; if (pendingTo) transitionTo(pendingTo); },
        Math.max(0, minThinkingMs - (now - thinkMs)));
      return;
    }
    transitionTo(next);
  };

  actions.idle.reset().play();
  currentAction = actions.idle;

  return {
    mixer,
    actions,
    getCurrentState: () => current,
    setState,
    update: (dt: number) => mixer.update(Math.max(0, dt)),
    dispose: () => {
      clearPending();
      try { Object.values(actions).forEach((a) => a.stop()); } catch { /**/ }
      try { mixer.stopAllAction(); } catch { /**/ }
      try { mixer.uncacheRoot(mixerRoot); } catch { /**/ }
    },
    debug: { clips: debugClips },
  };
}