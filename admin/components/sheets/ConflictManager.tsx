"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Check,
  X,
  FileDiff,
  Database,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ConflictItem = {
  id: string;
  status: "OPEN" | "RESOLVED";
  resolution: "KEEP_SHEET" | "KEEP_DB" | "MERGE" | null;
  spreadsheetId: string;
  sheetTitle: string | null;
  rowNumber: number | null;
  studentId: string | null;
  message: string | null;
  detectedAt: string;
  resolvedAt: string | null;
};

type ConflictDetail = ConflictItem & {
  sheetPayload: any;
  dbPayload: any;
};

interface ConflictManagerProps {
  conflicts: ConflictItem[];
  conflictDetail: ConflictDetail | null;
  selectedConflictId: string | null;
  setSelectedConflictId: (id: string | null) => void;
  onResolve: (data: any) => void;
  isResolving: boolean;
  dict: any;
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

const FIELDS = [
  "student_number",
  "fullname",
  "email",
  "phone",
  "status",
  "cohort",
  "student_uuid",
  "group",
] as const;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function ConflictManager({
  conflicts,
  conflictDetail,
  selectedConflictId,
  setSelectedConflictId,
  onResolve,
  isResolving,
  dict,
}: ConflictManagerProps) {
  const [mergePayload, setMergePayload] = React.useState<any | null>(null);

  React.useEffect(() => {
    setMergePayload(null);
  }, [selectedConflictId]);

  const handleMergeStart = () => {
    const base =
      conflictDetail?.sheetPayload ?? conflictDetail?.dbPayload ?? {};
    setMergePayload({ ...base });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      {/* Left Column: Conflict List */}
      <Card className="h-fit">
        <CardHeader className="p-4">
          <CardTitle className="text-lg flex items-center justify-between">
            {dict?.sheets?.conflictsTitle ?? "Conflicts"}
            <Badge variant="destructive" className="ml-2 font-mono">
              {conflicts.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            {dict?.sheets?.conflictsDesc ?? "Differences between Sheet and DB"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {conflicts.length > 0 ? (
              <div className="divide-y divide-border">
                {conflicts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConflictId(c.id)}
                    className={cn(
                      "w-full p-4 text-left transition-colors hover:bg-muted/50",
                      selectedConflictId === c.id &&
                        "bg-muted ring-1 ring-inset ring-primary/20 shadow-sm",
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-semibold text-sm truncate max-w-[180px]">
                        {c.studentId
                          ? `Student: ${c.studentId.slice(0, 8)}`
                          : "(no uuid)"}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold text-red-500 border-red-200"
                      >
                        {c.sheetTitle ?? "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <FileSpreadsheet className="h-3 w-3" />
                      <span>Row {c.rowNumber}</span>
                      <span className="mx-1">•</span>
                      <span>{formatDateTime(c.detectedAt)}</span>
                    </div>
                    <div className="text-xs line-clamp-2 italic text-slate-500">
                      {c.message ??
                        "Field mismatch detected during synchronization"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Check className="h-12 w-12 text-emerald-500/20 mb-2" />
                <p>{dict?.sheets?.noConflicts ?? "No open conflicts found."}</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Column: Comparison & Action */}
      <Card className="min-h-[500px]">
        {!conflictDetail ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-12 text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <FileDiff className="h-8 w-8 text-primary/40" />
            </div>
            <div>
              <p className="font-medium">Select a conflict</p>
              <p className="text-sm">
                Choose a record from the list to compare and resolve data
                discrepancies.
              </p>
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="bg-muted/30 border-b p-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Conflict Detail</CardTitle>
                  <CardDescription>
                    Comparing <strong>{conflictDetail.sheetTitle}</strong> (Row{" "}
                    {conflictDetail.rowNumber}) with database record.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onResolve({ resolution: "KEEP_SHEET" })}
                    disabled={isResolving}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Keep Sheet
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onResolve({ resolution: "KEEP_DB" })}
                    disabled={isResolving}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Keep DB
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleMergeStart}
                    disabled={isResolving || mergePayload !== null}
                  >
                    Merge
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6">
                <div className="grid grid-cols-[120px_1fr_1fr] gap-4 font-bold text-xs uppercase text-muted-foreground tracking-wider pb-2 border-b">
                  <div>Field</div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-3 w-3" /> Source (Sheet)
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-3 w-3" /> Target (DB)
                  </div>
                </div>

                <div className="space-y-3">
                  {FIELDS.map((field) => {
                    const sheetVal = safeStr(
                      conflictDetail.sheetPayload?.[field],
                    );
                    const dbVal = safeStr(conflictDetail.dbPayload?.[field]);
                    const isDifferent = sheetVal !== dbVal;

                    return (
                      <div
                        key={field}
                        className={cn(
                          "grid grid-cols-[120px_1fr_1fr] gap-4 items-center p-3 rounded-lg border",
                          isDifferent
                            ? "bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30"
                            : "bg-muted/20 border-transparent text-muted-foreground",
                        )}
                      >
                        <div className="text-xs font-semibold uppercase">
                          {field.replace(/_/g, " ")}
                        </div>

                        <div
                          className={cn(
                            "text-sm font-medium p-1 rounded transition-colors",
                            isDifferent &&
                              "bg-red-100/50 text-red-900 font-bold dark:bg-red-900/50 dark:text-red-100",
                          )}
                        >
                          {sheetVal || (
                            <span className="text-muted-foreground italic">
                              empty
                            </span>
                          )}
                        </div>

                        <div
                          className={cn(
                            "text-sm font-medium p-1 rounded transition-colors",
                            isDifferent &&
                              "bg-emerald-100/50 text-emerald-900 font-bold dark:bg-emerald-900/50 dark:text-emerald-100",
                          )}
                        >
                          {dbVal || (
                            <span className="text-muted-foreground italic">
                              empty
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {mergePayload && (
                  <div className="mt-8 space-y-4 p-5 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary p-1.5 rounded-lg">
                          <FileDiff className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <h4 className="font-bold text-lg">Custom Merge</h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMergePayload(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-sm text-muted-foreground italic">
                      Edit fields below to create the final record. ID fields
                      are locked.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {FIELDS.map((f) => {
                        if (f === "student_uuid" || f === "student_number")
                          return null;
                        return (
                          <div key={f} className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-slate-500 pl-1">
                              {f.replace(/_/g, " ")}
                            </label>
                            <Input
                              value={safeStr(mergePayload[f])}
                              className="bg-background focus-visible:ring-primary h-9"
                              onChange={(e) =>
                                setMergePayload({
                                  ...mergePayload,
                                  [f]: e.target.value,
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setMergePayload(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() =>
                          onResolve({
                            resolution: "MERGE",
                            mergedPayload: mergePayload,
                          })
                        }
                        disabled={isResolving}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Confirm & Save Resolution
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
