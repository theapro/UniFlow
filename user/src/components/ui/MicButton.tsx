"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MicButton(props: {
  active: boolean;
  processing?: boolean;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  const { active, processing = false, disabled = false, onClick } = props;

  return (
    <div className="relative pointer-events-auto">
      <AnimatePresence>
        {active ? (
          <motion.div
            key="pulse"
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full",
              "bg-foreground/10",
              "blur-xl",
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: [0.25, 0.55, 0.25],
              scale: [1, 1.18, 1],
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </AnimatePresence>

      <Button
        type="button"
        size="icon"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "relative h-16 w-16 rounded-full",
          "bg-foreground text-background hover:bg-foreground/90",
          "shadow-2xl",
          "transition-transform active:scale-95",
          disabled ? "opacity-70" : "",
        )}
        aria-label={
          active ? "Stop voice" : processing ? "Processing" : "Start voice"
        }
      >
        {processing ? (
          <Loader2 className="size-7 animate-spin" />
        ) : active ? (
          <Square className="size-7 fill-current" />
        ) : (
          <Mic className="size-7" />
        )}
      </Button>
    </div>
  );
}
