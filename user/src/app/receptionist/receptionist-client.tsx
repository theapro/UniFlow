"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  VrmAvatarStage,
  type ThreeDLeiaMode,
} from "@/components/3d-leia/VrmAvatarStage";
import {
  ParticleSphere,
  type VoiceVizMode,
} from "@/components/voice/ParticleSphere";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn, generateId } from "@/lib/utils";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { toast } from "sonner";
import { Loader2, Mic, Square } from "lucide-react";

type ReceptionistSender = "USER" | "ASSISTANT";

type ReceptionistMessage = {
  id: string;
  sender: ReceptionistSender;
  modality: "TEXT" | "VOICE";
  text: string;
  createdAt: string;
};

type ReceptionistInitData = {
  conversationId: string;
  avatar: {
    name: string;
    modelUrl: string | null;
    voice: string | null;
    language: "UZ" | "EN" | "JP";
    personality: "FRIENDLY" | "FORMAL";
  };
  messages: ReceptionistMessage[];
};

function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isoNow() {
  return new Date().toISOString();
}

function welcomeFor(
  language: ReceptionistInitData["avatar"]["language"],
  name: string,
) {
  if (language === "JP")
    return `こんにちは。${name}です。ご用件を教えてください。`;
  if (language === "EN") return `Hello. I'm ${name}. How can I help?`;
  return `Salom! Men ${name}. Qanday yordam bera olaman?`;
}

export function ReceptionistClient(props: {
  backendUrl: string;
  cookieConversationId: string | null;
  initialData: ReceptionistInitData | null;
  initialError: string | null;
}) {
  const { backendUrl, cookieConversationId, initialData, initialError } = props;

  const [conversationId, setConversationId] = useState(
    safeText(initialData?.conversationId) || cookieConversationId || "",
  );

  const [messages, setMessages] = useState<ReceptionistMessage[]>(
    Array.isArray(initialData?.messages) ? initialData!.messages : [],
  );

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const analyzer = useAudioAnalyzer({
    fftSize: 1024,
    smoothingTimeConstant: 0.86,
  });

  const voice = useVoiceChat({
    endpoint: "/api/receptionist/voice",
    keepStreamAlive: true,
    onInputStream: (stream) => {
      analyzer.setInputStream(stream);
      analyzer.start();
    },
    onOutputAudioElement: (el) => {
      analyzer.setOutputElement(el);
      analyzer.start();
    },
    onResult: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          sender: "USER",
          modality: "VOICE",
          text: result.transcript,
          createdAt: isoNow(),
        },
        {
          id: generateId(),
          sender: "ASSISTANT",
          modality: "VOICE",
          text: result.text,
          createdAt: isoNow(),
        },
      ]);
    },
    onError: (msg) => toast.error(msg),
    maxDurationMs: 20000,
    silenceMs: 1600,
  });

  const avatarMode: ThreeDLeiaMode = useMemo(() => {
    if (voice.isSpeaking) return "speaking";
    if (voice.isListening) return "listening";
    if (voice.isProcessing || sending) return "processing";
    return "idle";
  }, [sending, voice.isListening, voice.isProcessing, voice.isSpeaking]);

  const orbMode: VoiceVizMode = useMemo(() => {
    if (voice.isSpeaking) return "speaking";
    if (voice.isProcessing || voice.isListening) return "processing";
    return "idle";
  }, [voice.isListening, voice.isProcessing, voice.isSpeaking]);

  const orbLevelRef = voice.isSpeaking
    ? analyzer.outputLevelRef
    : analyzer.inputLevelRef;

  const orbFrequencyRef = voice.isSpeaking
    ? analyzer.outputFrequencyDataRef
    : analyzer.inputFrequencyDataRef;

  const modelUrl = useMemo(() => {
    const raw = safeText(initialData?.avatar?.modelUrl);
    if (!raw) return "/3dleia/leia.vrm";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    return `${backendUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
  }, [backendUrl, initialData?.avatar?.modelUrl]);

  const welcomeMessage = useMemo(() => {
    const avatarName = safeText(initialData?.avatar?.name) || "LEIA";
    const language = (initialData?.avatar?.language ?? "UZ") as any;
    return {
      id: "welcome",
      sender: "ASSISTANT" as const,
      modality: "TEXT" as const,
      text: welcomeFor(language, avatarName),
      createdAt: isoNow(),
    } satisfies ReceptionistMessage;
  }, [initialData?.avatar?.language, initialData?.avatar?.name]);

  const renderedMessages = messages.length > 0 ? messages : [welcomeMessage];

  const sendText = useCallback(
    async (message: string) => {
      const cleaned = message.trim();
      if (!cleaned) return;
      if (sending) return;

      setSending(true);
      setText("");

      const optimistic: ReceptionistMessage = {
        id: generateId(),
        sender: "USER",
        modality: "TEXT",
        text: cleaned,
        createdAt: isoNow(),
      };

      setMessages((prev) => [...prev, optimistic]);

      try {
        const res = await fetch("/api/receptionist/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: cleaned,
            modality: "TEXT",
          }),
        });

        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new Error(String(json?.error ?? res.statusText));
        }

        const replyText = safeText(json?.replyText || json?.text).trim();
        const nextConversationId = safeText(json?.conversationId).trim();
        if (nextConversationId && nextConversationId !== conversationId) {
          setConversationId(nextConversationId);
        }

        if (replyText) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              sender: "ASSISTANT",
              modality: "TEXT",
              text: replyText,
              createdAt: isoNow(),
            },
          ]);
        }
      } catch (e: any) {
        toast.error(String(e?.message ?? "Failed to send"));
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await sendText(text);
    },
    [sendText, text],
  );

  const onVoiceToggle = useCallback(async () => {
    if (initialError) {
      toast.error("Receptionist is unavailable right now");
      return;
    }
    if (!conversationId) {
      toast.error("Conversation is not ready yet");
      return;
    }

    try {
      await voice.unlockPlayback();
    } catch {
      // ignore
    }

    await voice.toggle({ sessionId: conversationId });
  }, [conversationId, initialError, voice]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background to-muted/30" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-[1400px] flex-col px-4 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="pointer-events-auto">
            <div className="text-lg font-semibold">AI Receptionist</div>
            <div className="text-sm text-muted-foreground">
              {safeText(initialData?.avatar?.name) || "LEIA"}
            </div>
          </div>

          {initialError ? (
            <div className="pointer-events-auto rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              {initialError}
            </div>
          ) : null}
        </div>

        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <VrmAvatarStage
              mode={avatarMode}
              speakingLevelRef={analyzer.outputLevelRef}
              listeningLevelRef={analyzer.inputLevelRef}
              modelUrl={modelUrl}
              className={cn(
                "pointer-events-auto",
                "h-[420px] w-full max-w-[920px]",
                "sm:h-[520px]",
              )}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 flex justify-end pb-[210px] pt-20">
            <div
              className={cn(
                "pointer-events-auto",
                "mx-auto w-full max-w-[640px]",
                "md:mx-0 md:mr-2 md:w-[380px]",
                "rounded-2xl border border-border/50 bg-background/60 backdrop-blur",
                "shadow-xl",
                "flex flex-col",
              )}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium">Chat</div>
                <div className="text-xs text-muted-foreground">
                  {voice.isListening
                    ? "Listening…"
                    : voice.isProcessing
                      ? "Processing…"
                      : voice.isSpeaking
                        ? "Speaking…"
                        : sending
                          ? "Sending…"
                          : "Ready"}
                </div>
              </div>
              <Separator />

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  {renderedMessages.map((m) => {
                    const isUser = m.sender === "USER";
                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex",
                          isUser ? "justify-end" : "justify-start",
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                            isUser
                              ? "bg-foreground text-background"
                              : "border border-border/50 bg-background/40",
                          )}
                        >
                          <div className="whitespace-pre-wrap">{m.text}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
              </div>

              <Separator />
              <form onSubmit={onSubmit} className="flex gap-2 p-3">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message…"
                  disabled={sending || Boolean(initialError)}
                />
                <Button
                  type="submit"
                  disabled={!text.trim() || sending || Boolean(initialError)}
                >
                  Send
                </Button>
              </form>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-3">
            <div
              className={cn(
                "pointer-events-auto",
                "relative",
                "rounded-full",
                "border border-border/40",
                "bg-background/30",
                "backdrop-blur",
                Boolean(initialError) || !conversationId ? "opacity-70" : "",
              )}
              onClick={onVoiceToggle}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void onVoiceToggle();
              }}
              aria-label={
                voice.isListening
                  ? "Stop listening"
                  : voice.isProcessing
                    ? "Processing"
                    : voice.isSpeaking
                      ? "Stop speaking"
                      : "Start voice"
              }
            >
              <ParticleSphere
                mode={orbMode}
                levelRef={orbLevelRef}
                frequencyDataRef={orbFrequencyRef}
                className="w-[260px]"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full",
                    "bg-foreground text-background",
                    "shadow-2xl",
                  )}
                  aria-hidden
                >
                  {voice.isProcessing ? (
                    <Loader2 className="size-7 animate-spin" />
                  ) : voice.isListening || voice.isSpeaking ? (
                    <Square className="size-7 fill-current" />
                  ) : (
                    <Mic className="size-7" />
                  )}
                </div>
              </div>
            </div>

            <div className="pointer-events-auto text-xs text-muted-foreground">
              {voice.isSpeaking
                ? "Tap to interrupt"
                : voice.isListening
                  ? "Listening…"
                  : "Tap to talk"}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
