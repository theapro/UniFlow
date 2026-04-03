import { ThreeDLeiaExperience } from "@/components/3d/ThreeDLeiaExperience";
import { getThreeDLeiaConfig } from "@/lib/leia-config";

export const dynamic = "force-dynamic";

export default async function ThreeDLeiaRoute() {
  const cfg = await getThreeDLeiaConfig();

  return (
    <ThreeDLeiaExperience
      config={{
        title: cfg.title,
        modelUrl: cfg.modelUrl,
        modelOffset: cfg.modelOffset,
      }}
    />
  );
}
