"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type {
  DebugField,
  DebugTextBlock,
} from "./ReceptionistDebugOverlay";

function safeJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return "";
    }
  }
}

export function ReceptionistDebugModal(props: {
  enabled: boolean;
  title?: string;
  description?: string;
  fields: DebugField[];
  textBlocks?: DebugTextBlock[];
  json?: unknown;
  className?: string;
}) {
  const {
    enabled,
    title = "DEBUG",
    description,
    fields,
    textBlocks,
    json,
    className,
  } = props;

  const compactFields = React.useMemo(() => {
    return fields
      .map((f) => ({ label: String(f.label), value: String(f.value) }))
      .filter((f) => f.label.trim().length > 0);
  }, [fields]);

  const jsonText = React.useMemo(() => safeJson(json), [json]);

  if (!enabled) return null;

  return (
    <div className={cn("fixed bottom-3 right-3 z-50", className)}>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
          >
            Debug
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className={cn(
            "w-[620px] max-w-[95vw]",
            "overflow-y-auto",
            "font-mono",
          )}
        >
          <SheetHeader>
            <SheetTitle className="font-mono">{title}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {description ??
                "Live state: speaking / listening / thinking, plus runtime debug data."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-[190px_1fr] gap-x-4 gap-y-2 text-xs">
              {compactFields.map((f) => (
                <React.Fragment key={`${f.label}:${f.value}`}>
                  <div className="text-muted-foreground">{f.label}</div>
                  <div className="break-words">{f.value || "—"}</div>
                </React.Fragment>
              ))}
            </div>

            {textBlocks?.length ? (
              <div className="space-y-4">
                {textBlocks.map((b) => (
                  <div key={b.label}>
                    <div className="text-xs text-muted-foreground">
                      {b.label}
                    </div>
                    <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
                      {b.value || ""}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}

            {jsonText ? (
              <div>
                <div className="text-xs text-muted-foreground">debugInfo</div>
                <pre className="mt-2 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
                  {jsonText}
                </pre>
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground">
              Tip: enable via <span className="font-semibold">?debug=1</span>{" "}
              or set localStorage{" "}
              <span className="font-semibold">receptionistDebug=1</span>.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
