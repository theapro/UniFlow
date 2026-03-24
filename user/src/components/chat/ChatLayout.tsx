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
import { useVoiceChat } from "@/hooks/use-voice-chat";
import { VoiceChatModal } from "@/components/VoiceChatModal";

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
  const [emptyGreeting, setEmptyGreeting] = useState<string>(
    "Qanday yordam bera olaman?",
  );
  const [greetingLoaded, setGreetingLoaded] = useState(false);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const voice = useVoiceChat({
    onResult: async (result) => {
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSession();
        setCurrentSession(sessionId);
      }

      // Add user + assistant messages (no redesign; behaves like a normal chat turn)
      addMessage(sessionId, {
        id: generateId(),
        role: "user",
        content: result.transcript,
        createdAt: new Date(),
      });

      addMessage(sessionId, {
        id: generateId(),
        role: "assistant",
        content: result.text,
        createdAt: new Date(),
      });
    },
    onError: (msg) => {
      console.warn(msg);
      toast.error(msg);
    },
    maxDurationMs: 10000,
    silenceMs: 2500,
  });

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
    if (greetingLoaded) return;
    if (currentMessages.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/greeting", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as any;
        const greeting = String(json?.data?.greeting ?? "").trim();
        if (!cancelled && greeting.length > 0) {
          setEmptyGreeting(greeting);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setGreetingLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMessages.length, greetingLoaded]);

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
          model: selectedModel?.model,
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

  const handleOpenVoiceModal = () => {
    if (isLoading || isStreaming) return;
    setVoiceModalOpen(true);
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
                {emptyGreeting}
              </h2>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-4 pt-8">
              {currentMessages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {(isLoading || isStreaming) && (
                <div className="flex items-center gap-4 px-4 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Thinking
                    <span className="thinking-dots" aria-hidden="true">
                      <span className="thinking-dot">.</span>
                      <span className="thinking-dot">.</span>
                      <span className="thinking-dot">.</span>
                    </span>
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
              onToggleVoice={handleOpenVoiceModal}
              isVoiceRecording={voice.isRecording}
              isVoiceProcessing={voice.isProcessing}
              isVoiceSpeaking={voice.isSpeaking}
            />
          </div>
        </div>
      </div>

      <VoiceChatModal
        open={voiceModalOpen}
        onOpenChange={(open) => {
          setVoiceModalOpen(open);
          if (!open) voice.cancel();
        }}
        voice={voice}
        ensureSessionId={ensureVoiceSessionId}
        chatModel={selectedModel?.model}
      />

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
