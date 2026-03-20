import { AsyncLocalStorage } from "node:async_hooks";

export type AiDebugClassification = {
  type: "tool" | "llm";
  confidence: number;
};

export type AiDebugTool = {
  selected: string | null;
  reason: string | null;
};

export type AiDebugExecution = {
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type AiDebugContext = {
  userId: string | null;
  role: string | null;
  studentId: string | null;
  teacherId: string | null;
  groupId: string | null;
  sessionId: string | null;
  requestId: string | null;
};

export type PrismaQueryTrace = {
  toolName: string | null;
  model: string | null;
  action: string;
  args: any;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  resultCount: number | null;
  sample: any;
  error: string | null;
};

export type AiDebugDatabase = {
  // Back-compat / quick view (the most recent query)
  query: any | null;
  params: Record<string, unknown>;
  resultCount: number | null;
  sample: any;

  // Full trace (every Prisma query during this request)
  queries: PrismaQueryTrace[];
};

export type AiDebugTrace = {
  message: string;

  classification: AiDebugClassification;

  tool: AiDebugTool;

  execution: AiDebugExecution;

  database: AiDebugDatabase;

  context: AiDebugContext;

  warnings: string[];
  errors: string[];

  finalResponse: string;
};

function safeStringify(value: any, maxLen: number): string {
  try {
    const s = JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "bigint") return v.toString();
        return v;
      },
      2,
    );
    if (s.length <= maxLen) return s;
    return s.slice(0, Math.max(0, maxLen - 1)) + "…";
  } catch {
    return "[unserializable]";
  }
}

function safeJson(value: any, maxJsonLen: number) {
  const s = safeStringify(value, maxJsonLen);
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function extractResultCount(result: any): number | null {
  if (Array.isArray(result)) return result.length;
  if (result && typeof result === "object") {
    // Prisma aggregate/count often returns { _count: { ... } } or number
    if (typeof (result as any).count === "number") return (result as any).count;
  }
  return null;
}

export type AiDebugRuntime = {
  trace: AiDebugTrace;
  toolName: string | null;
  setToolName: (name: string | null) => void;
  addWarning: (w: string) => void;
  addError: (e: string) => void;
  addPrismaQuery: (
    q: Omit<PrismaQueryTrace, "args" | "sample"> & {
      args: any;
      sample: any;
    },
  ) => void;
};

const als = new AsyncLocalStorage<AiDebugRuntime>();

export function getAiDebugRuntime(): AiDebugRuntime | null {
  return als.getStore() ?? null;
}

export async function runWithAiDebugRuntime<T>(
  runtime: AiDebugRuntime,
  fn: () => Promise<T>,
): Promise<T> {
  return als.run(runtime, fn);
}

export function createAiDebugRuntime(params: {
  message: string;
  classification: AiDebugClassification;
  tool: AiDebugTool;
  context: AiDebugContext;
  startedAt: Date;
}): AiDebugRuntime {
  const startedAtIso = params.startedAt.toISOString();

  const trace: AiDebugTrace = {
    message: params.message,
    classification: params.classification,
    tool: params.tool,
    execution: {
      startedAt: startedAtIso,
      endedAt: startedAtIso,
      durationMs: 0,
    },
    database: {
      query: null,
      params: {},
      resultCount: null,
      sample: null,
      queries: [],
    },
    context: params.context,
    warnings: [],
    errors: [],
    finalResponse: "",
  };

  const runtime: AiDebugRuntime = {
    trace,
    toolName: null,
    setToolName: (name) => {
      runtime.toolName = name;
    },
    addWarning: (w) => {
      const msg = String(w ?? "").trim();
      if (!msg) return;
      if (!runtime.trace.warnings.includes(msg))
        runtime.trace.warnings.push(msg);
    },
    addError: (e) => {
      const msg = String(e ?? "").trim();
      if (!msg) return;
      runtime.trace.errors.push(msg);
    },
    addPrismaQuery: (q) => {
      const args = safeJson(q.args, 25_000);
      const sample = safeJson(q.sample, 10_000);

      const entry: PrismaQueryTrace = {
        toolName: q.toolName,
        model: q.model,
        action: q.action,
        args,
        startedAt: q.startedAt,
        endedAt: q.endedAt,
        durationMs: q.durationMs,
        resultCount: q.resultCount,
        sample,
        error: q.error,
      };

      runtime.trace.database.queries.push(entry);

      // Quick view points to the most recent query
      runtime.trace.database.query = {
        model: entry.model,
        action: entry.action,
        args: entry.args,
      };
      runtime.trace.database.resultCount = entry.resultCount;
      runtime.trace.database.sample = entry.sample;

      // Try to expose common params (helps groupId/studentId debugging)
      const where = (entry.args as any)?.where;
      if (where && typeof where === "object" && !Array.isArray(where)) {
        for (const k of Object.keys(where)) {
          const v = (where as any)[k];
          if (typeof v === "string" || typeof v === "number") {
            runtime.trace.database.params[k] = v as any;
          }
        }
      }
    },
  };

  return runtime;
}

export function finalizeAiDebugTrace(params: {
  runtime: AiDebugRuntime;
  startedAtMs: number;
  endedAtMs: number;
  finalResponse: string;
}) {
  params.runtime.trace.execution.endedAt = new Date(
    params.endedAtMs,
  ).toISOString();
  params.runtime.trace.execution.durationMs = Math.max(
    0,
    params.endedAtMs - params.startedAtMs,
  );
  params.runtime.trace.finalResponse = String(params.finalResponse ?? "");

  // Automatic warnings
  const q = params.runtime.trace.database.queries;
  if (q.some((x) => x.error)) {
    params.runtime.addWarning("At least one Prisma query failed");
  }
  if (q.length === 0) {
    params.runtime.addWarning("No Prisma query executed");
  }
  if (q.some((x) => x.resultCount === 0)) {
    params.runtime.addWarning(
      "Empty DB result (resultCount=0) — possible filter/date/group mismatch",
    );
  }

  // Date mismatch heuristics: equality filter on `date` often fails with timezones
  if (
    q.some((x) => {
      const where = (x.args as any)?.where;
      if (!where || typeof where !== "object") return false;
      const d = (where as any).date;
      if (!d) return false;
      // If date is a scalar (string/Date), it's equality.
      if (typeof d === "string") return true;
      if (d instanceof Date) return true;
      // If object but without gte/lt/lte/gt, also suspicious.
      if (typeof d === "object" && !Array.isArray(d)) {
        const hasRange = "gte" in d || "lte" in d || "gt" in d || "lt" in d;
        return !hasRange;
      }
      return false;
    })
  ) {
    params.runtime.addWarning(
      "Date filter looks like exact equality — prefer day range (gte/lte) to avoid timezone mismatch",
    );
  }

  // Group mismatch heuristics
  const ctxGroupId = params.runtime.trace.context.groupId;
  if (
    ctxGroupId &&
    q.some((x) => {
      const where = (x.args as any)?.where;
      const qGroupId =
        where && typeof where === "object" ? (where as any).groupId : null;
      return (
        typeof qGroupId === "string" &&
        qGroupId.length > 0 &&
        qGroupId !== ctxGroupId
      );
    })
  ) {
    params.runtime.addWarning(
      "Group mismatch — schedule/group query groupId != resolved student.groupId",
    );
  }

  // Relation null heuristics
  if (
    q.some((x) => {
      const s = x.sample;
      if (!s || typeof s !== "object") return false;
      const teacher = (s as any).teacher;
      return teacher === null;
    })
  ) {
    params.runtime.addWarning(
      "Teacher is null — possible missing relation/include",
    );
  }
}

export function prismaMiddlewareCapture(params: {
  model: string | null;
  action: string;
  args: any;
  startedAtMs: number;
  endedAtMs: number;
  result: any;
  error: any;
}) {
  const runtime = getAiDebugRuntime();
  if (!runtime) return;

  const startedAt = new Date(params.startedAtMs).toISOString();
  const endedAt = new Date(params.endedAtMs).toISOString();

  const resultCount = params.error ? null : extractResultCount(params.result);
  const sample = params.error
    ? null
    : Array.isArray(params.result)
      ? (params.result[0] ?? null)
      : (params.result ?? null);

  const errMsg = params.error
    ? typeof params.error?.message === "string"
      ? params.error.message
      : String(params.error)
    : null;

  runtime.addPrismaQuery({
    toolName: runtime.toolName,
    model: params.model,
    action: params.action,
    args: params.args,
    startedAt,
    endedAt,
    durationMs: Math.max(0, params.endedAtMs - params.startedAtMs),
    resultCount,
    sample,
    error: errMsg,
  });

  // Console logging for production debugging (kept compact)
  try {
    const where = (params.args as any)?.where;
    console.log("PRISMA QUERY", {
      toolName: runtime.toolName,
      model: params.model,
      action: params.action,
      where: where ?? null,
      resultCount,
      sample:
        sample && typeof sample === "object"
          ? Array.isArray(sample)
            ? sample[0]
            : sample
          : sample,
      error: errMsg,
    });
  } catch {
    // ignore
  }
}
