"use client";

import React, { useState } from "react";
import { Message } from "@/types/chat";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";
import { AssistantMessageBubble } from "@/components/chat/AssistantMessageBubble";

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return isUser ? (
    <UserMessageBubble
      content={message.content}
      copied={copied}
      onCopy={handleCopy}
    />
  ) : (
    <AssistantMessageBubble
      content={message.content}
      copied={copied}
      onCopy={handleCopy}
    />
  );
}
