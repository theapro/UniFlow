"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chatStore";
import type { Message } from "@/types/chat";
import {
  buildChatExportFilename,
  buildChatExportMarkdown,
  downloadTextFile,
} from "@/lib/chatExport";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function ExportChatButton() {
  const { sessions, currentSessionId, isStreaming, isLoading } = useChatStore();
  const [isExporting, setIsExporting] = useState(false);

  const currentTitle = useMemo(() => {
    if (!currentSessionId) return "AI Chat";
    const s = sessions.find((x) => x.id === currentSessionId);
    return String(s?.title ?? "AI Chat");
  }, [currentSessionId, sessions]);

  const disabled = !currentSessionId || isExporting || isStreaming || isLoading;

  const onExport = async () => {
    if (!currentSessionId) {
      toast.error("No chat selected");
      return;
    }

    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/chat/export?sessionId=${encodeURIComponent(currentSessionId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Export failed");
      }

      const json = (await res.json()) as any;
      const raw = Array.isArray(json?.data) ? json.data : [];

      const messages: Message[] = raw
        .map((m: any) => {
          const sender = String(m.sender ?? "");
          const role = sender === "USER" ? "user" : "assistant";
          const content = String(m.message ?? "");
          return {
            id: String(m.id ?? ""),
            role,
            content,
            createdAt: toDate(m.timestamp),
          } as Message;
        })
        .filter((m: Message) => m.id && m.content.length > 0);

      const content = buildChatExportMarkdown({
        title: currentTitle,
        sessionId: currentSessionId,
        messages,
      });

      const filename = buildChatExportFilename({
        title: currentTitle,
        ext: "md",
      });

      downloadTextFile({
        filename,
        content,
        mime: "text/markdown;charset=utf-8",
      });

      toast.success("Chat exported");
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "Export failed";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onExport}
      disabled={disabled}
      aria-label="Export current chat"
      title={
        disabled ? "Select a chat to export" : "Export this chat as Markdown"
      }
    >
      <Download className="mr-2 h-4 w-4" />
      Export
    </Button>
  );
}
