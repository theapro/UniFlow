"use client";

import React, { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chatStore";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateId } from "@/lib/utils";
import { Message } from "@/types/chat";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export function ChatLayout() {
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
  } = useChatStore();

  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const [inputHeight, setInputHeight] = useState<number>(160);
  const [showWarning, setShowWarning] = useState(false);

  const currentMessages = currentSessionId
    ? messages[currentSessionId] || []
    : [];

  // Initial hydration from DB
  useEffect(() => {
    if (sessions.length === 0) {
      loadSessions().catch((e) => console.error("Failed to load sessions", e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      content,
      createdAt: new Date(),
    };

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
          message: content,
          model: "qwen/qwen3-32b",
          temperature: 0.7,
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

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine || trimmedLine === "data: [DONE]") {
            continue;
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
      }

      if (!accumulatedContent) {
        throw new Error("No response from AI");
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <ScrollArea
        ref={scrollAreaRef}
        className="min-h-0 flex-1 scrollbar-thin mb-20"
      >
        <div className={currentMessages.length > 0 ? "pb-32" : ""}>
          {currentMessages.length === 0 ? (
            <div className="flex h-[70vh] flex-col items-center justify-center p-8 text-center">
              <h2 className="text-3xl mb-10 font-bold tracking-tight text-foreground">
                Qanday yordam bera olaman?
              </h2>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 pt-8">
              {currentMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && !isStreaming && (
                <div className="flex items-center gap-4 px-4 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    O&apos;ylayapman...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Fade effekti */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-background via-background to-transparent" />

      {/* Chat Input Konteyneri */}
      <div
        className={`
          absolute inset-x-0 transition-all duration-500 ease-in-out z-20
          ${currentMessages.length === 0 ? "bottom-1/2 translate-y-1/2" : "bottom-6"}
        `}
      >
        <div className="mx-auto w-full -ml-1 px-4">
          <div ref={inputRef}>
            <ChatInput
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isLoading={isLoading}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>

      {/* DOIMIY PASTDA TURUVCHI YOZUV */}
      {showWarning && (
        <div className="absolute bottom-1  inset-x-0 z-30 flex items-center justify-center pointer-events-none animate-in fade-in duration-700">
          <p className="text-[11px] text-muted-foreground py-1 px-2 rounded-md">
            Uniflow can make mistakes. Check important info.
          </p>
        </div>
      )}
    </div>
  );
}
