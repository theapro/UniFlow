"use client";

import React, { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type DebugField = {
  label: string;
  value: string;
};

export type DebugTextBlock = {
  label: string;
  value: string;
};

function isTruthyFlag(v: string | null): boolean {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function computeEnabledFromClient(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("debug");
    const ls = window.localStorage.getItem("receptionistDebug");
    return isTruthyFlag(q) || isTruthyFlag(ls);
  } catch {
    return false;
  }
}

export function setReceptionistDebugEnabled(next: boolean) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("receptionistDebug", next ? "1" : "0");
    window.dispatchEvent(new Event("receptionist-debug-changed"));
  } catch {
    // ignore
  }
}

export function useReceptionistDebugEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const update = () => setEnabled(computeEnabledFromClient());
    update();

    window.addEventListener("receptionist-debug-changed", update);
    window.addEventListener("storage", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("receptionist-debug-changed", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("popstate", update);
    };
  }, []);

  return enabled;
}

export function ReceptionistDebugOverlay(props: {
  enabled: boolean;
  title?: string;
  fields: DebugField[];
  textBlocks?: DebugTextBlock[];
  className?: string;
}) {
  const { enabled, title = "DEBUG", fields, textBlocks, className } = props;

  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? "" : new Date().toLocaleTimeString(),
  );

  useEffect(() => {
    if (!enabled) return;
    const t = window.setInterval(() => {
      setNow(new Date().toLocaleTimeString());
    }, 500);
    return () => window.clearInterval(t);
  }, [enabled]);

  const compactFields = useMemo(() => {
    return fields
      .map((f) => ({ label: String(f.label), value: String(f.value) }))
      .filter((f) => f.label.trim().length > 0);
  }, [fields]);

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "fixed bottom-3 left-3 z-50",
        "w-[460px] max-w-[92vw]",
        "max-h-[70vh] overflow-auto",
        "rounded-md border border-border/60",
        "bg-background/80 backdrop-blur",
        "p-3 shadow-sm",
        "text-xs text-foreground",
        "font-mono",
        className,
      )}
      aria-label="Debug overlay"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wide">{title}</div>
        <div className="text-[11px] text-muted-foreground">{now}</div>
      </div>

      <div className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
        {compactFields.map((f) => (
          <React.Fragment key={`${f.label}:${f.value}`}>
            <div className="text-muted-foreground">{f.label}</div>
            <div className="break-words">{f.value || "—"}</div>
          </React.Fragment>
        ))}
      </div>

      {textBlocks?.length ? (
        <div className="mt-3 space-y-2">
          {textBlocks.map((b) => (
            <div key={b.label}>
              <div className="text-muted-foreground">{b.label}</div>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-2">
                {b.value || ""}
              </pre>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 text-[11px] text-muted-foreground">
        Tip: enable via <span className="font-semibold">?debug=1</span> or set
        localStorage <span className="font-semibold">receptionistDebug=1</span>.
      </div>
    </div>
  );
}
