"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn, generateId } from "@/lib/utils";
import { stripThinkBlocks } from "@/lib/assistantText";

import type { ReceptionistInitData, ReceptionistMessage } from "../types";

function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isoNow() {
  return new Date().toISOString();
}

function emitAvatarState(
  state: "idle" | "thinking" | "talking",
  ttlMs?: number,
) {
  try {
    window.dispatchEvent(
      new CustomEvent("receptionist:avatar-state", {
        detail: { state, ttlMs },
      }),
    );
  } catch {
    // ignore
  }
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

export function ReceptionistChatPanel(props: {
  initialData: ReceptionistInitData | null;
  initialError: string | null;
}) {
  const { initialData, initialError } = props;

  const [conversationId, setConversationId] = useState(
    safeText(initialData?.conversationId),
  );

  const [messages, setMessages] = useState<ReceptionistMessage[]>(
    Array.isArray(initialData?.messages)
      ? initialData!.messages.map((m) => ({
          ...m,
          text: stripThinkBlocks(m.text),
        }))
      : [],
  );

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setConversationId(safeText(initialData?.conversationId));
    setMessages(
      Array.isArray(initialData?.messages)
        ? initialData!.messages.map((m) => ({
            ...m,
            text: stripThinkBlocks(m.text),
          }))
        : [],
    );
  }, [initialData]);

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

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
      if (initialError) {
        toast.error("Receptionist is unavailable right now");
        return;
      }
      if (!conversationId) {
        toast.error("Conversation is not ready yet");
        return;
      }

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

      // Let the avatar show THINKING while we wait.
      emitAvatarState("thinking");

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

        const replyText = stripThinkBlocks(
          safeText(json?.replyText || json?.text),
        ).trim();
        const nextConversationId = safeText(json?.conversationId).trim();
        if (nextConversationId && nextConversationId !== conversationId) {
          setConversationId(nextConversationId);
        }

        if (replyText) {
          // Show TALKING briefly while text appears.
          emitAvatarState("talking", 1600);
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
        } else {
          emitAvatarState("idle", 1);
        }
      } catch (e: any) {
        toast.error(String(e?.message ?? "Failed to send"));
        emitAvatarState("idle", 1);
      } finally {
        setSending(false);
      }
    },
    [conversationId, initialError, sending],
  );

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await sendText(text);
    },
    [sendText, text],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-medium">Chat</div>
        <div className="text-xs text-muted-foreground">
          {sending ? "Sending…" : initialError ? "Offline" : "Ready"}
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
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isUser
                      ? "bg-foreground text-background"
                      : "border border-border/50 bg-background/40",
                  )}
                >
                  <div className="whitespace-pre-wrap">
                    {stripThinkBlocks(m.text)}
                  </div>
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
  );
}
