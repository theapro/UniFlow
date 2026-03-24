"use client";

import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Settings2,
  ChevronDown,
  ArrowUp,
  StopCircle,
  Mic,
  Loader2,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  isLoading: boolean;
  isStreaming: boolean;
  disabled?: boolean;
  className?: string;
  onToggleVoice?: () => void;
  isVoiceRecording?: boolean;
  isVoiceProcessing?: boolean;
  isVoiceSpeaking?: boolean;
}

export function ChatInput({
  onSendMessage,
  onStopGeneration,
  isLoading,
  isStreaming,
  disabled = false,
  className,
  onToggleVoice,
  isVoiceRecording = false,
  isVoiceProcessing = false,
  isVoiceSpeaking = false,
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
      if (textareaRef.current) textareaRef.current.style.height = "auto";
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
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  }, [message]);

  const canSend = message.trim().length > 0 && !isLoading && !isStreaming;

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="mx-auto max-w-3xl px-4">
        <div className="group relative flex flex-col rounded-[28px] border border-white/10 bg-zinc-900/40 backdrop-blur-2xl shadow-2xl transition-all duration-300 focus-within:border-white/20 focus-within:bg-zinc-900/60">
          
          {/* TEXTAREA AREA */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nimani bilishni xohlaysiz?"
            disabled={disabled || isLoading}
            className="min-h-[60px] max-h-[200px] w-full resize-none border-0 bg-transparent py-4 px-6 text-base text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-0 shadow-none scrollbar-hide"
            rows={1}
          />

          {/* ACTION BAR */}
          <div className="flex items-center justify-between px-3 pb-3 pt-0">
            
            {/* CHAP TOMON: TOOLS */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <Plus className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                className="h-9 gap-1.5 rounded-full px-3 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">Tools</span>
              </Button>
            </div>

            {/* O'NG TOMON: MODELS, VOICE & SEND */}
            <div className="flex items-center gap-1.5">
              
              {/* MODEL SELECTOR (O'NGDA) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 gap-2 rounded-full px-3 text-zinc-400 hover:text-white hover:bg-white/5 data-[state=open]:bg-white/5"
                    disabled={models.length === 0}
                  >
                    <span className="text-[11px] font-black uppercase tracking-wider">
                      {selectedModel?.displayName?.split(" ")[0] ?? "Model"}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-40" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  sideOffset={8}
                  className="w-52 rounded-[20px] bg-zinc-900/95 border-white/10 backdrop-blur-3xl p-1 shadow-2xl animate-in fade-in zoom-in-95"
                >
                   <div className="px-3 py-2 text-[9px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 mb-1">Select Engine</div>
                   <DropdownMenuRadioGroup value={selectedModelId ?? ""} onValueChange={(v) => v && setSelectedModel(v)}>
                    {models.map((m) => (
                      <DropdownMenuRadioItem 
                        key={m.id} 
                        value={m.id}
                        className="rounded-[12px] py-2 px-3 text-xs text-zinc-400 focus:bg-white/5 focus:text-white transition-colors cursor-pointer"
                      >
                        {m.displayName}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-4 w-[1px] bg-white/10 mx-0.5" />

              {/* VOICE BUTTON */}
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleVoice}
                disabled={!onToggleVoice || disabled || isLoading || isStreaming}
                className={cn(
                  "h-9 w-9 rounded-full transition-all duration-300",
                  isVoiceRecording ? "text-red-500 bg-red-500/10 ring-1 ring-red-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5",
                  isVoiceSpeaking && "text-emerald-500 bg-emerald-500/10"
                )}
              >
                {isVoiceProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isVoiceSpeaking ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <Mic className={cn("h-4 w-4", isVoiceRecording && "animate-pulse")} />
                )}
              </Button>

              {/* SEND / STOP BUTTON */}
              {isStreaming ? (
                <Button
                  size="icon"
                  onClick={onStopGeneration}
                  className="h-9 w-9 rounded-full bg-white text-black hover:bg-zinc-200"
                >
                  <StopCircle className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!canSend}
                  className={cn(
                    "h-9 w-9 rounded-full transition-all duration-300",
                    canSend 
                      ? "bg-white text-black shadow-lg shadow-white/5" 
                      : "bg-zinc-800 text-zinc-600 opacity-40"
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
  );
}