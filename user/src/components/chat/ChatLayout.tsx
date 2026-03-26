"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateId } from "@/lib/utils";
import { Message } from "@/types/chat";
import { toast } from "sonner";
import { QuickActions } from "@/components/chat/QuickActions";
import { MessageList } from "@/components/chat/MessageList";
import { auth } from "@/lib/auth";
import { useRouter } from "next/navigation";

function normalizeUserInput(input: string): string {
  return String(input ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnorableUserInput(input: string): boolean {
  const s = normalizeUserInput(input).toLowerCase();
  if (!s) return true;
  if (s.length < 1) return true;
  const noise = new Set([".", "..", "...", "000", "00", "0", "uh", "um", "ah"]);
  if (noise.has(s)) return true;
  if (/^(\.|0)+$/.test(s)) return true;
  const noPunct = s
    .replace(/[.\-_,!?:;"'`~()\[\]{}<>\\/|@#$%^&*=+]/g, "")
    .trim();
  if (!noPunct) return true;
  return false;
}

function detectLangForUi(input: string): "en" | "ja" | "uz" {
  const s = String(input ?? "");
  if (/[\u3040-\u30FF\u4E00-\u9FFF]/.test(s)) return "ja";
  if (/[ЎўҚқҒғҲҳ]/.test(s)) return "uz";
  const lower = s.toLowerCase();
  if (/(\bjadval\b|\bdavomat\b|\bbaho\b|\bdars\b)/.test(lower)) return "uz";
  return "en";
}

function nonRepeatingFallback(lang: "en" | "ja" | "uz"): string {
  if (lang === "ja")
    return "すみません、同じ返答になってしまいました。もう少し詳しく教えてください。";
  if (lang === "uz")
    return "Uzr, bir xil javob qaytarilib qoldi. Iltimos, biroz batafsil yozing.";
  return "Sorry — I’m repeating myself. Could you add a bit more detail?";
}

export function ChatLayout() {
  const router = useRouter();
  const {
    sessions,
    currentSessionId,
    messages,
    isLoading,
    isStreaming,
    setLoading,
    setStreaming,
    addMessage,
    updateLastMessage,
    createSession,
    setCurrentSession,
    loadSessions,
    loadMessages,
    loadModels,
    models,
    selectedModelId,
  } = useChatStore();

  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(160);
  const [showWarning, setShowWarning] = useState(false);
  const [userFirstName, setUserFirstName] = useState<string>("there");

  const currentMessages = currentSessionId
    ? messages[currentSessionId] || []
    : [];

  // Initial hydration from DB
  useEffect(() => {
    if (sessions.length === 0) {
      loadSessions().catch((e) => console.error("Failed to load sessions", e));
    }
    if (models.length === 0) {
      loadModels().catch((e) => console.error("Failed to load models", e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId)
    : null;

  useEffect(() => {
    // Best-effort: show user's first name in empty state.
    const u = auth.getStoredUser();
    const nameRaw = String(u?.fullName ?? u?.name ?? u?.email ?? "").trim();
    if (!nameRaw) return;
    const first = nameRaw.split(/\s+/).filter(Boolean)[0];
    if (first) setUserFirstName(first);
  }, []);

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) return;
    if (messages[currentSessionId]) return;
    loadMessages(currentSessionId).catch((e) =>
      console.error("Failed to load messages", e),
    );
  }, [currentSessionId, loadMessages, messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages.length, isStreaming]);

  useEffect(() => {
    if (currentMessages.length > 0) {
      // ChatInput tushib bo'lishini kutamiz (masalan 800ms)
      const timer = setTimeout(() => {
        setShowWarning(true);
      }, 800);

      return () => clearTimeout(timer);
    } else {
      // Agar chat tozalansa, yozuvni ham yashiramiz
      setShowWarning(false);
    }
  }, [currentMessages.length]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setInputHeight(entry.contentRect.height);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleSendMessage = async (content: string) => {
    if (isLoading || isStreaming) return;

    const cleaned = normalizeUserInput(content);
    if (isIgnorableUserInput(cleaned)) {
      // Ignore noise/ghost inputs: do not create a session, do not call backend.
      return;
    }

    let sessionId = currentSessionId;

    // Create new session if none exists
    if (!sessionId) {
      sessionId = await createSession();
      setCurrentSession(sessionId);
    }

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: cleaned,
      createdAt: new Date(),
    };

    // Track previous assistant message to avoid repeated responses.
    const prevAssistant = (messages[sessionId] || [])
      .slice()
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" && String(m.content || "").trim().length > 0,
      );

    addMessage(sessionId, userMessage);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };

    addMessage(sessionId, assistantMessage);

    setLoading(true);
    setStreaming(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: cleaned,
          model: selectedModel?.model,
          temperature: 0.7,
          contextLimit: 12,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedContent = "";
      let buffer = "";
      let doneSignal = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine) continue;
          if (trimmedLine === "data: [DONE]") {
            doneSignal = true;
            break;
          }

          if (trimmedLine.startsWith("data: ")) {
            const jsonStr = trimmedLine.slice(6);

            try {
              const data = JSON.parse(jsonStr);

              if (data.content) {
                accumulatedContent += data.content;
                updateLastMessage(sessionId, accumulatedContent);
              }
            } catch (e) {
              console.error("Error parsing stream data:", e);
            }
          }
        }

        if (doneSignal) break;
      }

      if (!accumulatedContent) {
        throw new Error("No response from AI");
      }

      // Final de-dupe: if assistant replied with the exact same text twice in a row, replace it.
      if (
        prevAssistant?.content &&
        String(prevAssistant.content).trim() === accumulatedContent.trim()
      ) {
        const lang = detectLangForUi(cleaned);
        updateLastMessage(sessionId, nonRepeatingFallback(lang));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          toast.info("Generation stopped");
        } else {
          console.error("Chat error:", error);
          toast.error("Failed to get response from AI");
        }
      } else {
        console.error("Unknown error:", error);
        toast.error("An unknown error occurred");
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      setAbortController(null);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const ensureVoiceSessionId = async (): Promise<string> => {
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
      setCurrentSession(sessionId);
    }
    return sessionId;
  };

  const handleOpenVoicePage = () => {
    if (isLoading || isStreaming) return;
    router.push("/dashboard/voice");
  };

  if (currentMessages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Hi {userFirstName}, Where should we start?
          </h2>

          <QuickActions
            className="mt-6"
            disabled={isLoading || isStreaming}
            onAction={(prompt) => handleSendMessage(prompt)}
          />

          <div className="mt-8 w-full">
            <div ref={inputRef}>
              <ChatInput
                onSendMessage={handleSendMessage}
                onStopGeneration={handleStopGeneration}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onToggleVoice={handleOpenVoicePage}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1 scrollbar-thin">
        <div className="pb-32 mb-[100px]">
          <MessageList
            messages={currentMessages}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-background via-background to-transparent" />

      <div className="absolute inset-x-0 bottom-6 z-20">
        <div className="mx-auto w-full px-4 -ml-1">
          <div ref={inputRef}>
            <ChatInput
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isLoading={isLoading}
              isStreaming={isStreaming}
              onToggleVoice={handleOpenVoicePage}
            />
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="absolute inset-x-0 bottom-1 z-30 flex items-center justify-center pointer-events-none animate-in fade-in duration-700">
          <p className="text-[11px] text-muted-foreground py-1 px-2 rounded-md">
            Uniflow can make mistakes. Check important info.
          </p>
        </div>
      )}
    </div>
  );
}
