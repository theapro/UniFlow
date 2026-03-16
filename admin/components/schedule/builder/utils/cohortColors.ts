export function cohortColorHsl(input: {
  code?: string | null;
  sortOrder?: number | null;
}): string | null {
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? input.sortOrder
      : null;

  const code = input.code ? String(input.code) : "";

  const index = (() => {
    // Prefer stable code-based hashing.
    // NOTE: sortOrder can legitimately be identical/missing for many cohorts;
    // using it as the primary source can collapse all colors to the same value.
    if (code) {
      let hash = 0;
      for (let i = 0; i < code.length; i += 1) {
        hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
      }
      return (hash % 5) + 1;
    }

    if (sortOrder !== null) {
      const normalized = Math.abs(Math.trunc(sortOrder));
      return (normalized % 5) + 1;
    }

    return null;
  })();

  if (!index) return null;
  return `hsl(var(--chart-${index}))`;
}
