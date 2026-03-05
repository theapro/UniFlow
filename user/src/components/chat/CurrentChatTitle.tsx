"use client";

import { useMemo } from "react";
import { useChatStore } from "@/store/chatStore";

export function CurrentChatTitle({
  fallback = "AI Chat",
}: {
  fallback?: string;
}) {
  const { sessions, currentSessionId } = useChatStore();

  const title = useMemo(() => {
    if (!currentSessionId) return fallback;
    const s = sessions.find((x) => x.id === currentSessionId);
    const t = s?.title?.trim();
    return t && t.length > 0 ? t : fallback;
  }, [currentSessionId, fallback, sessions]);

  return <>{title}</>;
}
