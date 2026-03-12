export function jsonStringArray(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : null))
      .filter((v): v is string => Boolean(v));
  }
  return [];
}
