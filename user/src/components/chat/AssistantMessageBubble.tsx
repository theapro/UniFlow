"use client";

import React, { type CSSProperties, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Check,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Share2,
  RotateCcw,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Brain,
} from "lucide-react";

export function AssistantMessageBubble({
  content,
  copied,
  onCopy,
}: {
  content: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const [showThought, setShowThought] = useState(false);

  // Parse content to separate thought and actual response
  const formatContent = (rawContent: string) => {
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
    const thought = thinkMatch ? thinkMatch[1].trim() : null;
    const cleanContent = rawContent
      .replace(/<think>[\s\S]*?<\/think>/, "")
      .trim();

    return { thought, cleanContent };
  };

  const { thought, cleanContent } = formatContent(content);

  return (
    <div className="group flex w-full justify-start py-4">
      <div className="relative w-full break-words text-foreground">
        {/* Thought Section */}
        {thought && (
          <div className="mb-4">
            <button
              onClick={() => setShowThought(!showThought)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/50">
                <Brain className="h-3 w-3" />
              </div>
              <span>{showThought ? "Hide reasoning" : "Show reasoning"}</span>
              {showThought ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>

            {showThought && (
              <div className="mt-2 border-l-2 border-muted pl-4 py-1 italic text-xs text-muted-foreground/80 bg-muted/20 rounded-r-md animate-in fade-in slide-in-from-top-1 duration-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {thought}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_p]:my-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const language = match ? match[1] : "";
                const isCodeBlock = Boolean(language);

                return isCodeBlock ? (
                  <div className="relative my-4 overflow-hidden rounded-xl shadow-sm">
                    <div className="absolute right-2 top-2">
                      <CopyCodeButton
                        code={String(children).replace(/\n$/, "")}
                      />
                    </div>
                    <SyntaxHighlighter
                      style={
                        vscDarkPlus as unknown as Record<string, CSSProperties>
                      }
                      language={language}
                      PreTag="div"
                      className="rounded-md"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {cleanContent || content}
          </ReactMarkdown>
        </div>

        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Good response"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Bad response"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Regenerate"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      className="h-8 w-8"
      onClick={handleCopy}
      title="Copy code"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
