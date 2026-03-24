"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Mic, Square } from "lucide-react";

export type VoiceChatModalVoice = {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  response: string;
  error: string | null;
  speakingLevel: number;
  beginTurn: (params: {
    sessionId?: string;
    chatModel?: string;
  }) => Promise<void>;
  stopListening: () => void;
  stopSpeaking: () => void;
  cancel: () => void;
  stopProcessing: () => void;
};

type VoiceChatModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voice: VoiceChatModalVoice;
  ensureSessionId: () => Promise<string>;
  chatModel?: string;
};

export function VoiceChatModal({
  open,
  onOpenChange,
  voice,
  ensureSessionId,
  chatModel,
}: VoiceChatModalProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const startedForOpenRef = useRef(false);

  const status = useMemo(() => {
    if (voice.isProcessing) return "Thinking";
    if (voice.isSpeaking) return "Speaking";
    if (voice.isListening) return "Listening";
    return "Idle";
  }, [voice.isListening, voice.isProcessing, voice.isSpeaking]);

  useEffect(() => {
    if (!open) {
      startedForOpenRef.current = false;
      setLocalError(null);
      return;
    }

    if (startedForOpenRef.current) return;
    startedForOpenRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        console.debug("[voice-modal] opened; starting recording");
        const sessionId = await ensureSessionId();
        if (cancelled) return;
        await voice.beginTurn({ sessionId, chatModel });
      } catch (e) {
        console.error("[voice-modal] failed to start voice turn", e);
        setLocalError("Failed to start voice chat");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, ensureSessionId, voice, chatModel]);

  const handleClose = () => {
    try {
      voice.cancel();
    } catch {
      // ignore
    }
    onOpenChange(false);
  };

  const handleManualStop = () => {
    // stopListening() triggers the recorder stop; auto-send runs in the hook.
    voice.stopListening();
  };

  const handleStartAgain = async () => {
    try {
      const sessionId = await ensureSessionId();
      await voice.beginTurn({ sessionId, chatModel });
    } catch (e) {
      console.error("[voice-modal] failed to start again", e);
      setLocalError("Failed to start recording");
    }
  };

  const sphereState = voice.isSpeaking
    ? "speaking"
    : voice.isProcessing
      ? "thinking"
      : voice.isListening
        ? "listening"
        : "idle";

  const sphereScale = useMemo(() => {
    if (sphereState !== "speaking") return 1;
    return 1 + Math.max(0, Math.min(1, voice.speakingLevel)) * 0.22;
  }, [sphereState, voice.speakingLevel]);

  const combinedError = localError ?? voice.error;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn(
          "bg-sidebar text-sidebar-foreground border-border/60",
          "max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">Voice chat</div>
            <div className="text-xs text-muted-foreground">
              {status}
              {voice.isListening ? " (auto-stop on silence)" : null}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close voice chat"
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 py-4">
          <div
            className={cn(
              "voice-sphere",
              `voice-sphere--${sphereState}`,
              "text-foreground",
            )}
            style={
              sphereState === "speaking"
                ? { transform: `scale(${sphereScale})` }
                : undefined
            }
            aria-label={`Voice sphere: ${sphereState}`}
          />

          <div className="text-sm text-muted-foreground">{status}</div>

          <div className="flex items-center gap-2">
            {voice.isListening ? (
              <Button
                variant="outline"
                onClick={handleManualStop}
                className="h-9 rounded-full"
              >
                <Square className="h-4 w-4" />
                <span className="ml-2 text-sm">Stop</span>
              </Button>
            ) : voice.isProcessing ? (
              <Button
                variant="outline"
                onClick={() => voice.stopProcessing()}
                className="h-9 rounded-full"
              >
                <span className="text-sm">Cancel</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleStartAgain}
                className="h-9 rounded-full"
              >
                <Mic className="h-4 w-4" />
                <span className="ml-2 text-sm">Start</span>
              </Button>
            )}
          </div>

          {combinedError ? (
            <div className="text-xs text-destructive text-center">
              {combinedError}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-border/60 bg-background/40 p-3">
          <div className="text-xs font-medium">Debug</div>
          <div className="mt-2 grid gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">state</span>
              <span>
                {voice.isListening
                  ? "listening"
                  : voice.isProcessing
                    ? "thinking"
                    : voice.isSpeaking
                      ? "speaking"
                      : "idle"}
              </span>
            </div>

            <div>
              <div className="text-muted-foreground">transcript</div>
              <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2">
                {voice.transcript || "(empty)"}
              </pre>
            </div>

            <div>
              <div className="text-muted-foreground">AI response</div>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2">
                {voice.response || "(empty)"}
              </pre>
            </div>

            {combinedError ? (
              <div>
                <div className="text-muted-foreground">error</div>
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2">
                  {combinedError}
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        <style jsx>{`
          .voice-sphere {
            width: 144px;
            height: 144px;
            border-radius: 9999px;
            background: hsl(var(--foreground) / 0.08);
            box-shadow: 0 0 0 1px hsl(var(--foreground) / 0.12);
            transition: transform 140ms ease;
          }

          .voice-sphere--idle {
            animation: voicePulse 2400ms ease-in-out infinite;
          }

          .voice-sphere--listening {
            box-shadow:
              0 0 0 1px hsl(var(--foreground) / 0.12),
              0 0 0 10px hsl(var(--foreground) / 0.06);
            animation: voiceListen 900ms ease-in-out infinite;
          }

          .voice-sphere--thinking {
            animation: voiceThink 1800ms linear infinite;
          }

          .voice-sphere--speaking {
            box-shadow:
              0 0 0 1px hsl(var(--foreground) / 0.16),
              0 0 0 14px hsl(var(--foreground) / 0.08);
          }

          @keyframes voicePulse {
            0% {
              transform: scale(1);
              opacity: 0.92;
            }
            50% {
              transform: scale(1.03);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 0.92;
            }
          }

          @keyframes voiceListen {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.06);
            }
            100% {
              transform: scale(1);
            }
          }

          @keyframes voiceThink {
            0% {
              transform: rotate(0deg) scale(1);
            }
            100% {
              transform: rotate(360deg) scale(1);
            }
          }
        `}</style>
      </AlertDialogContent>
    </AlertDialog>
  );
}
