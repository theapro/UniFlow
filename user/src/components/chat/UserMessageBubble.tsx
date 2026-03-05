"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserMessageBubble({
  content,
  copied,
  onCopy,
}: {
  content: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="group flex w-full flex-col items-end py-2">
      <div className="relative max-w-[85%] break-words rounded-2xl bg-muted px-4 py-3 text-foreground dark:bg-zinc-800">
        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_p]:my-1">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
      <div className="mt-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onCopy}
          title="Copy"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
