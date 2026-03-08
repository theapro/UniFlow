import { randomUUID } from "crypto";

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

const REDACT_KEYS = new Set([
  "password",
  "pass",
  "pwd",
  "token",
  "authorization",
  "cookie",
  "set-cookie",
  "jwt",
  "idtoken",
  "accesstoken",
  "refresh_token",
  "access_token",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as any).constructor === Object
  );
}

export function redact(value: unknown, depth = 0, maxDepth = 6): JsonLike {
  if (depth > maxDepth) return "[MaxDepth]";

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return "[Function]";

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, depth + 1, maxDepth));
  }

  if (isPlainObject(value)) {
    const out: Record<string, JsonLike> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redact(v, depth + 1, maxDepth);
      }
    }
    return out;
  }

  // Errors / Dates / other objects
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    };
  }

  try {
    return redact(JSON.parse(JSON.stringify(value)), depth + 1, maxDepth);
  } catch {
    return String(value);
  }
}

export function createRequestId(): string {
  return randomUUID();
}

export function logInfo(scope: string, message: string, meta?: unknown) {
  if (meta === undefined) {
    console.log(`[${scope}] ${message}`);
  } else {
    console.log(`[${scope}] ${message}`, redact(meta));
  }
}

export function logWarn(scope: string, message: string, meta?: unknown) {
  if (meta === undefined) {
    console.warn(`[${scope}] ${message}`);
  } else {
    console.warn(`[${scope}] ${message}`, redact(meta));
  }
}

export function logError(scope: string, message: string, meta?: unknown) {
  if (meta === undefined) {
    console.error(`[${scope}] ${message}`);
  } else {
    console.error(`[${scope}] ${message}`, redact(meta));
  }
}
