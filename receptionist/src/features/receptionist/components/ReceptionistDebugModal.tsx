"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { DebugField, DebugTextBlock } from "./ReceptionistDebugOverlay";

const AVATAR_TRANSFORM_ENABLED_KEY = "receptionistAvatarTransformEnabled";
const AVATAR_TRANSFORM_KEY = "receptionistAvatarTransform";
const AVATAR_TRANSFORM_EVENT = "receptionist:avatar-transform";

type AvatarTransform = {
  position: { x: number; y: number; z: number };
  rotationDeg: { x: number; y: number; z: number };
  scale: number;
};

type AvatarTransformDraft = {
  position: { x: string; y: string; z: string };
  rotationDeg: { x: string; y: string; z: string };
  scale: string;
};

const DEFAULT_AVATAR_TRANSFORM: AvatarTransform = {
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: 1,
};

const DEFAULT_AVATAR_TRANSFORM_DRAFT: AvatarTransformDraft = {
  position: { x: "0", y: "0", z: "0" },
  rotationDeg: { x: "0", y: "0", z: "0" },
  scale: "1",
};

function toFiniteNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function draftToTransform(draft: AvatarTransformDraft): AvatarTransform {
  return {
    position: {
      x: toFiniteNumber(draft.position.x, 0),
      y: toFiniteNumber(draft.position.y, 0),
      z: toFiniteNumber(draft.position.z, 0),
    },
    rotationDeg: {
      x: toFiniteNumber(draft.rotationDeg.x, 0),
      y: toFiniteNumber(draft.rotationDeg.y, 0),
      z: toFiniteNumber(draft.rotationDeg.z, 0),
    },
    scale: toFiniteNumber(draft.scale, 1),
  };
}

function transformToDraft(transform: AvatarTransform): AvatarTransformDraft {
  return {
    position: {
      x: String(transform.position.x ?? 0),
      y: String(transform.position.y ?? 0),
      z: String(transform.position.z ?? 0),
    },
    rotationDeg: {
      x: String(transform.rotationDeg.x ?? 0),
      y: String(transform.rotationDeg.y ?? 0),
      z: String(transform.rotationDeg.z ?? 0),
    },
    scale: String(transform.scale ?? 1),
  };
}

function readAvatarTransformFromStorage(): {
  enabled: boolean;
  transform: AvatarTransform;
} {
  if (typeof window === "undefined") {
    return { enabled: false, transform: DEFAULT_AVATAR_TRANSFORM };
  }

  const enabledRaw = window.localStorage.getItem(AVATAR_TRANSFORM_ENABLED_KEY);
  const enabled = enabledRaw === "1" || enabledRaw === "true";

  let transform = DEFAULT_AVATAR_TRANSFORM;
  try {
    const raw = window.localStorage.getItem(AVATAR_TRANSFORM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AvatarTransform>;
      transform = {
        position: {
          x: toFiniteNumber(parsed.position?.x, 0),
          y: toFiniteNumber(parsed.position?.y, 0),
          z: toFiniteNumber(parsed.position?.z, 0),
        },
        rotationDeg: {
          x: toFiniteNumber(parsed.rotationDeg?.x, 0),
          y: toFiniteNumber(parsed.rotationDeg?.y, 0),
          z: toFiniteNumber(parsed.rotationDeg?.z, 0),
        },
        scale: toFiniteNumber(parsed.scale, 1),
      };
    }
  } catch {
    // ignore invalid JSON
  }

  return { enabled, transform };
}

function writeAvatarTransformToStorage(args: {
  enabled: boolean;
  draft: AvatarTransformDraft;
}) {
  if (typeof window === "undefined") return;

  const transform = draftToTransform(args.draft);
  window.localStorage.setItem(
    AVATAR_TRANSFORM_ENABLED_KEY,
    args.enabled ? "1" : "0",
  );
  window.localStorage.setItem(AVATAR_TRANSFORM_KEY, JSON.stringify(transform));
  window.dispatchEvent(new CustomEvent(AVATAR_TRANSFORM_EVENT));
}

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
  showAvatarTransformControls?: boolean;
  className?: string;
}) {
  const {
    enabled,
    title = "DEBUG",
    description,
    fields,
    textBlocks,
    json,
    showAvatarTransformControls = false,
    className,
  } = props;

  const compactFields = React.useMemo(() => {
    return fields
      .map((f) => ({ label: String(f.label), value: String(f.value) }))
      .filter((f) => f.label.trim().length > 0);
  }, [fields]);

  const jsonText = React.useMemo(() => safeJson(json), [json]);

  const [customTransformEnabled, setCustomTransformEnabled] =
    React.useState(false);
  const [transformDraft, setTransformDraft] =
    React.useState<AvatarTransformDraft>(DEFAULT_AVATAR_TRANSFORM_DRAFT);

  React.useEffect(() => {
    if (!enabled) return;
    if (!showAvatarTransformControls) return;
    const { enabled: isOn, transform } = readAvatarTransformFromStorage();
    setCustomTransformEnabled(isOn);
    setTransformDraft(transformToDraft(transform));
  }, [enabled, showAvatarTransformControls]);

  const updateDraft = (
    patch: (prev: AvatarTransformDraft) => AvatarTransformDraft,
  ) => {
    setTransformDraft((prev) => {
      const next = patch(prev);
      writeAvatarTransformToStorage({
        enabled: customTransformEnabled,
        draft: next,
      });
      return next;
    });
  };

  return (
    <div className={cn("fixed bottom-3 right-3 z-50", className)}>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="font-mono text-xs">
            Debug
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className={cn("w-[620px] max-w-[95vw]", "overflow-y-auto", "text-sm")}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="text-xs">
              {description ??
                "Live state: speaking / listening / thinking, plus runtime debug data."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            {showAvatarTransformControls ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">
                      Avatar Transform
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Position is XYZ offset. Rotation is degrees. Use arrow
                      keys to nudge by the input step.
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={customTransformEnabled ? "secondary" : "outline"}
                      size="sm"
                      aria-pressed={customTransformEnabled}
                      onClick={() => {
                        const nextEnabled = !customTransformEnabled;
                        setCustomTransformEnabled(nextEnabled);
                        writeAvatarTransformToStorage({
                          enabled: nextEnabled,
                          draft: transformDraft,
                        });
                      }}
                    >
                      {customTransformEnabled
                        ? "Transform: ON"
                        : "Transform: OFF"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomTransformEnabled(false);
                        setTransformDraft(DEFAULT_AVATAR_TRANSFORM_DRAFT);
                        writeAvatarTransformToStorage({
                          enabled: false,
                          draft: DEFAULT_AVATAR_TRANSFORM_DRAFT,
                        });
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                {customTransformEnabled ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Position
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            X
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={transformDraft.position.x}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                position: { ...prev.position, x: v },
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            Y
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={transformDraft.position.y}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                position: { ...prev.position, y: v },
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            Z
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={transformDraft.position.z}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                position: { ...prev.position, z: v },
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Rotation (deg)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            X
                          </div>
                          <Input
                            type="number"
                            step="1"
                            value={transformDraft.rotationDeg.x}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                rotationDeg: { ...prev.rotationDeg, x: v },
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            Y
                          </div>
                          <Input
                            type="number"
                            step="1"
                            value={transformDraft.rotationDeg.y}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                rotationDeg: { ...prev.rotationDeg, y: v },
                              }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] text-muted-foreground">
                            Z
                          </div>
                          <Input
                            type="number"
                            step="1"
                            value={transformDraft.rotationDeg.z}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateDraft((prev) => ({
                                ...prev,
                                rotationDeg: { ...prev.rotationDeg, z: v },
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Scale</div>
                      <Input
                        type="number"
                        step="0.01"
                        value={transformDraft.scale}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateDraft((prev) => ({
                            ...prev,
                            scale: v,
                          }));
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <Separator className="opacity-60" />
              </div>
            ) : null}

            <div className="grid grid-cols-[190px_1fr] gap-x-4 gap-y-2 text-xs font-mono">
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
                    <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs font-mono">
                      {b.value || ""}
                    </pre>
                  </div>
                ))}
              </div>
            ) : null}

            {jsonText ? (
              <div>
                <div className="text-xs text-muted-foreground">debugInfo</div>
                <pre className="mt-2 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/30 p-3 text-xs font-mono">
                  {jsonText}
                </pre>
              </div>
            ) : null}

            <div className="text-xs text-muted-foreground">
              Tip: enable via <span className="font-semibold">?debug=1</span> or
              set localStorage{" "}
              <span className="font-semibold">receptionistDebug=1</span>.
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
