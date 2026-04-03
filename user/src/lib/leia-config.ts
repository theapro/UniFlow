import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const LeiaConfigSchema = z
  .object({
    title: z.string().optional(),
    modelUrl: z.string().optional(),
    modelOffset: z.array(z.number()).length(3).optional(),
  })
  .strict();

export type ThreeDLeiaConfig = {
  title: string;
  modelUrl: string;
  modelOffset: [number, number, number];
};

const DEFAULT_CONFIG: ThreeDLeiaConfig = {
  title: "3D LEIA",
  modelUrl: "/3dleia/leia.vrm",
  modelOffset: [0.22, -0.02, 0],
};

export async function getThreeDLeiaConfig(): Promise<ThreeDLeiaConfig> {
  const configPath = path.join(process.cwd(), "src", "config", "3d-leia.json");

  try {
    const raw = await readFile(configPath, "utf8");
    const json = JSON.parse(raw);

    const parsed = LeiaConfigSchema.safeParse(json);
    if (!parsed.success) return DEFAULT_CONFIG;

    const { title, modelUrl, modelOffset } = parsed.data;

    return {
      title: title ?? DEFAULT_CONFIG.title,
      modelUrl: modelUrl ?? DEFAULT_CONFIG.modelUrl,
      modelOffset:
        modelOffset && modelOffset.length === 3
          ? (modelOffset as [number, number, number])
          : DEFAULT_CONFIG.modelOffset,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
