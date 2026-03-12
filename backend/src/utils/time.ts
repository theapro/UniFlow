export function formatDbTime(
  value: string | Date | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    const hh = String(value.getUTCHours()).padStart(2, "0");
    const mm = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const v = String(value).trim();
  return v ? v : null;
}

export function formatTimeRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string | null {
  const s = formatDbTime(start);
  const e = formatDbTime(end);
  if (!s || !e) return null;
  return `${s}-${e}`;
}
