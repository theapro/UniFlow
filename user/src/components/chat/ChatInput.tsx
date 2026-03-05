"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Settings2,
  ChevronDown,
  ArrowUp,
  StopCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  onSendMessage,
  onStopGeneration,
  isLoading,
  isStreaming,
  disabled = false,
  className,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { models, selectedModelId, setSelectedModel } = useChatStore();
  const selectedModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId)
    : null;

  const handleSubmit = () => {
    if (message.trim() && !isLoading && !isStreaming) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = Math.min(scrollHeight, 200) + "px";
  }, [message]);

  const canSend = message.trim().length > 0 && !isLoading && !isStreaming;

  return (
    <div className={cn("w-full", className)}>
      <div className="mx-auto max-w-3xl px-4 pb-2">
        {/* Border va Radius o'zgartirildi, ranglar o'z holicha qoldi */}
        <div className="rounded-[24px] border bg-sidebar text-sidebar-foreground p-2">
          <div className="flex flex-col">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nimani bilishni xohlaysiz?"
              disabled={disabled || isLoading}
              className={cn(
                "min-h-[52px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base py-3 px-4",
              )}
              rows={1}
            />

            <div className="flex items-center justify-between px-2 pb-1">
              {/* Chap tomondagi iconlar */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                >
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="text-sm">Tools</span>
                </Button>
              </div>

              {/* O'ng tomondagi iconlar */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 gap-1 rounded-full px-3 text-muted-foreground hover:text-foreground"
                      disabled={models.length === 0}
                      aria-label="Select AI model"
                    >
                      <span className="text-sm font-medium">
                        {selectedModel?.displayName ??
                          (models.length === 0 ? "Model" : "Select")}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>AI Model</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={selectedModelId ?? ""}
                      onValueChange={(value) => {
                        if (value) setSelectedModel(value);
                      }}
                    >
                      {models.map((m) => (
                        <DropdownMenuRadioItem key={m.id} value={m.id}>
                          {m.displayName}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {isStreaming ? (
                  <Button
                    size="icon"
                    onClick={onStopGeneration}
                    className="h-9 w-9 rounded-full"
                  >
                    <StopCircle className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSubmit}
                    disabled={!canSend || disabled}
                    className={cn(
                      "h-9 w-9 rounded-full",
                      canSend
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <ArrowUp className="h-5 w-5 stroke-[3px]" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
