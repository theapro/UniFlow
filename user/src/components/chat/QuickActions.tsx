"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { id: "image", label: "Create image", prompt: "Create an image:" },
  { id: "music", label: "Create music", prompt: "Create a short music idea:" },
  { id: "write", label: "Write anything", prompt: "Write:" },
  {
    id: "boost",
    label: "Boost my day",
    prompt: "Boost my day with something positive.",
  },
  { id: "learn", label: "Help me learn", prompt: "Help me learn about:" },
] as const;

export function QuickActions({
  className,
  onAction,
  disabled,
}: {
  className?: string;
  onAction: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2",
        className,
      )}
    >
      {ACTIONS.map((a) => (
        <Button
          key={a.id}
          type="button"
          variant="outline"
          disabled={disabled}
          className="rounded-full border-white/10 bg-background/40 backdrop-blur hover:bg-background/60"
          onClick={() => onAction(a.prompt)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
