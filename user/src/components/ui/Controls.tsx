"use client";

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, MessageCircleMore, X } from "lucide-react";

import type { AudioAnalyzerSnapshot } from "@/hooks/useAudioAnalyzer";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { MicButton } from "@/components/ui/MicButton";

export function Controls(props: {
  micActive: boolean;
  micDisabled: boolean;
  onToggleMic: () => void | Promise<void>;

  debugOpen: boolean;
  onDebugOpenChange: (open: boolean) => void;

  audioSnapshot: AudioAnalyzerSnapshot;
  avatarStatus: { loaded: boolean; error: string | null };
  voiceDebug: {
    lastEvent: string;
    lastStopReason: string;
    recorderState: string;
    chunks: number;
    lastBlobBytes: number;
    isRecording: boolean;
    isProcessing: boolean;
    isSpeaking: boolean;
    latencyMs: number;
  };
}) {
  const {
    micActive,
    micDisabled,
    onToggleMic,
    debugOpen,
    onDebugOpenChange,
    audioSnapshot,
    avatarStatus,
    voiceDebug,
  } = props;

  const sidebar = useSidebar();

  const level = useMemo(() => {
    return Math.max(audioSnapshot.inputLevel, audioSnapshot.outputLevel);
  }, [audioSnapshot.inputLevel, audioSnapshot.outputLevel]);

  return (
    <>
      {/* Bottom-left: chat history toggle */}
      <div className="absolute bottom-6 left-6 z-30 pointer-events-none">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "pointer-events-auto",
            "h-10 w-10 rounded-full",
            "border border-border/40 bg-background/20 backdrop-blur",
          )}
          onClick={() => sidebar.toggleSidebar()}
          aria-label="Toggle chat history"
        >
          <MessageCircleMore className="size-4" />
        </Button>
      </div>

      {/* Bottom-right: debug toggle */}
      <div className="absolute bottom-6 right-6 z-30 pointer-events-none">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "pointer-events-auto",
            "h-10 w-10 rounded-full",
            "border border-border/40 bg-background/20 backdrop-blur",
          )}
          onClick={() => onDebugOpenChange(!debugOpen)}
          aria-label={debugOpen ? "Close debug" : "Open debug"}
        >
          <Bug className="size-4" />
        </Button>
      </div>

      {/* Bottom-center: mic */}
      <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 pointer-events-none">
        <div className="flex flex-col items-center gap-3">
          <AnimatePresence>
            {micActive ? (
              <motion.div
                key="wave"
                className="pointer-events-none"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <VoiceWaveform level={level} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <MicButton
            active={micActive}
            processing={voiceDebug.isProcessing}
            disabled={micDisabled}
            onClick={onToggleMic}
          />
        </div>
      </div>

      {/* Debug panel (secondary) */}
      <AnimatePresence>
        {debugOpen ? (
          <motion.div
            key="debug"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn(
              "absolute bottom-20 right-6 z-40 pointer-events-auto",
              "w-[320px] max-w-[92vw]",
              "rounded-2xl border border-border/40",
              "bg-background/40 backdrop-blur-xl",
              "shadow-2xl",
              "p-3",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">
                Debug
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => onDebugOpenChange(false)}
                aria-label="Close debug"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="mt-2 grid gap-1.5 text-[11px]">
              <Row
                k="avatar"
                v={
                  avatarStatus.loaded
                    ? "loaded"
                    : avatarStatus.error
                      ? "error"
                      : "loading"
                }
              />
              {avatarStatus.error ? (
                <div className="rounded-lg border border-border/40 bg-background/40 p-2 text-foreground">
                  {avatarStatus.error}
                </div>
              ) : null}

              <Row k="event" v={voiceDebug.lastEvent} />
              <Row k="stop" v={voiceDebug.lastStopReason} />
              <Row k="recorder" v={voiceDebug.recorderState} />
              <Row k="latency" v={`${voiceDebug.latencyMs} ms`} />

              <Row
                k="input"
                v={`${Math.round(audioSnapshot.inputLevel * 100)}%`}
              />
              <Row
                k="output"
                v={`${Math.round(audioSnapshot.outputLevel * 100)}%`}
              />

              <Row k="chunks" v={String(voiceDebug.chunks)} />
              <Row k="blob" v={`${voiceDebug.lastBlobBytes} bytes`} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Row(props: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{props.k}</span>
      <span className="truncate text-foreground">{props.v}</span>
    </div>
  );
}

function VoiceWaveform(props: { level: number }) {
  const level = Math.max(0, Math.min(1, props.level));
  const bars = [0, 1, 2, 3, 4];

  return (
    <div className="flex items-end justify-center gap-1">
      {bars.map((i) => {
        const peak = 0.55 + level * 1.3;
        const d = 0.9 + i * 0.08;
        return (
          <motion.span
            key={i}
            className={cn("w-1.5 rounded-full", "bg-foreground/60")}
            style={{ height: 14, transformOrigin: "bottom" }}
            animate={{
              scaleY: [0.35, peak, 0.35],
              opacity: [0.35, 0.75, 0.35],
            }}
            transition={{
              duration: d,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.06,
            }}
          />
        );
      })}
    </div>
  );
}
