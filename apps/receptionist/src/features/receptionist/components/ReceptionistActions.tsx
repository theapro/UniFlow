"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ReceptionistActionsActive = "avatar" | "voice";

export function ReceptionistActions(props: {
  active: ReceptionistActionsActive;
  chatHref: string;
  className?: string;
}) {
  const { active, chatHref, className } = props;

  return (
    <div
      className={cn(
        "absolute right-4 top-4 z-10 flex items-center gap-2",
        className,
      )}
      aria-label="Actions"
    >
      <Button
        asChild
        size="sm"
        variant={active === "avatar" ? "secondary" : "outline"}
      >
        <Link href="/receptionist/avatar">Avatar</Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant={active === "voice" ? "secondary" : "outline"}
      >
        <Link href="/receptionist/voice">Voice</Link>
      </Button>
      <Button asChild size="sm" variant="ghost">
        <Link href={chatHref}>Chat</Link>
      </Button>
    </div>
  );
}
