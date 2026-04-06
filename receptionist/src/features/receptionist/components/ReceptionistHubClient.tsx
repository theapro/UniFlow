"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import type { ReceptionistInitData } from "../types";
import { ReceptionistChatSheet } from "./ReceptionistChatSheet";

function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function ReceptionistHubClient(props: {
  chatOpen: boolean;
  initialData: ReceptionistInitData | null;
  initialError: string | null;
}) {
  const { chatOpen, initialData, initialError } = props;
  const router = useRouter();

  const avatarName = safeText(initialData?.avatar?.name) || "LEIA";

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background to-muted/40" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-4xl flex-col justify-center px-6 py-12">
        <div className="space-y-4">
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            AI Receptionist
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome, I am {avatarName}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Choose a mode to interact with LEIA.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/receptionist/voice">Start Voice</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/receptionist/avatar">View Avatar</Link>
          </Button>
        </div>

        <div className="mt-8">
          <Button asChild variant="ghost">
            <Link href="/receptionist/chat">Open Chat</Link>
          </Button>
        </div>

        {initialError ? (
          <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            {initialError}
          </div>
        ) : null}
      </div>

      <ReceptionistChatSheet
        open={chatOpen}
        onOpenChange={(open) => {
          if (!open) router.push("/receptionist");
        }}
        initialData={initialData}
        initialError={initialError}
      />
    </main>
  );
}
