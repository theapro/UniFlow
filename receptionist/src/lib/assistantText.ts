export function stripThinkBlocks(input: unknown): string {
  const s = typeof input === "string" ? input : String(input ?? "");

  let out = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<\/?think\b[^>]*>/gi, "");
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
