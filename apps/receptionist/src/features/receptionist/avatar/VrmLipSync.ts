import type { VRM } from "@pixiv/three-vrm";

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type VisemePair = readonly [vrm0: string, vrm1: string];

const VISEMES: readonly VisemePair[] = [
  ["a", "aa"],
  ["i", "ih"],
  ["u", "ou"],
  ["e", "ee"],
  ["o", "oh"],
] as const;

function safeSetExpression(vrm: VRM, key: string, value: number) {
  const mgr = (vrm as any)?.expressionManager;
  if (!mgr) return;
  try {
    mgr.setValue(key, clamp01(value));
  } catch {
    // ignore if expression not present
  }
}

function pickVisemeIndexFromSpectrum(
  frequencyData: Uint8Array | null | undefined,
): number | null {
  if (!frequencyData || frequencyData.length < 32) return null;

  let sum = 0;
  let weighted = 0;

  // Use a centroid-like metric over magnitudes.
  for (let i = 0; i < frequencyData.length; i++) {
    const v = frequencyData[i];
    sum += v;
    weighted += v * i;
  }

  if (sum <= 0) return null;

  const centroid = weighted / sum; // 0..bins
  const c = centroid / Math.max(1, frequencyData.length - 1); // 0..1

  // Rough mapping (low centroid -> round vowels, high centroid -> narrow vowels)
  if (c < 0.2) return 4; // oh
  if (c < 0.28) return 2; // ou
  if (c < 0.38) return 0; // aa
  if (c < 0.52) return 3; // ee
  return 1; // ih
}

export type VrmLipSyncController = {
  update: (params: {
    now: number; // seconds
    delta: number; // seconds
    level: number; // 0..1
    frequencyData?: Uint8Array | null;
    enabled: boolean;
  }) => void;
  reset: () => void;
};

export function createVrmLipSync(
  vrm: VRM,
  options?: {
    minLevel?: number;
    pickIntervalMs?: { min: number; max: number };
    openSpeed?: number;
    closeSpeed?: number;
  },
): VrmLipSyncController {
  const minLevel = options?.minLevel ?? 0.02;
  const pickIntervalMs = options?.pickIntervalMs ?? { min: 70, max: 130 };
  const openSpeed = options?.openSpeed ?? 18;
  const closeSpeed = options?.closeSpeed ?? 26;

  const current = new Array<number>(VISEMES.length).fill(0);
  let activeIndex = 0;
  let nextPickAt = 0;

  const reset = () => {
    for (let i = 0; i < VISEMES.length; i++) {
      current[i] = 0;
      const [k0, k1] = VISEMES[i];
      safeSetExpression(vrm, k0, 0);
      safeSetExpression(vrm, k1, 0);
    }
  };

  const update: VrmLipSyncController["update"] = ({
    now,
    delta,
    level,
    frequencyData,
    enabled,
  }) => {
    const l = clamp01(level);

    const mouthOpen = enabled && l >= minLevel ? clamp01(0.04 + l * 1.55) : 0;

    // Choose which viseme to drive at a controlled cadence.
    if (mouthOpen > 0 && now >= nextPickAt) {
      const picked = pickVisemeIndexFromSpectrum(frequencyData);
      if (picked != null) {
        activeIndex = picked;
      } else {
        activeIndex = (activeIndex + 1) % VISEMES.length;
      }

      const span = pickIntervalMs.max - pickIntervalMs.min;
      const jitter = span > 0 ? Math.random() * span : 0;
      nextPickAt = now + (pickIntervalMs.min + jitter) / 1000;
    }

    // Smoothly approach targets.
    for (let i = 0; i < VISEMES.length; i++) {
      const target = mouthOpen > 0 && i === activeIndex ? mouthOpen : 0;
      const speed = target > current[i] ? openSpeed : closeSpeed;
      const alpha = 1 - Math.exp(-speed * Math.max(0, delta));
      current[i] = lerp(current[i], target, alpha);

      const [k0, k1] = VISEMES[i];
      safeSetExpression(vrm, k0, current[i]);
      safeSetExpression(vrm, k1, current[i]);
    }
  };

  return { update, reset };
}
