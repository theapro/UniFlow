"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Message } from "@/types/chat";

export function MessageList({
  messages,
  isLoading,
  isStreaming,
}: {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      {messages.map((message) => (
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
    </div>
  );
}
