"use client";

import dynamic from "next/dynamic";

const AvatarExperienceClient = dynamic(
  () =>
    import("./AvatarExperienceClient").then((m) => m.AvatarExperienceClient),
  {
    ssr: false,
    loading: () => (
      <main className="min-h-[100dvh] bg-background text-foreground">
        <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col items-center justify-center px-6 text-center">
          <div className="text-lg font-medium">Loading avatar…</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Preparing 3D renderer
          </div>
        </div>
      </main>
    ),
  },
);

export function AvatarExperienceLazy(props: {
  assistantName?: string;
  conversationId: string | null;
  modelUrl: string | null;
}) {
  return <AvatarExperienceClient {...props} />;
}
