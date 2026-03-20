import type { Message } from "@/types/chat";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocalTimestamp(d: Date): string {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${year}-${month}-${day} ${hh}:${mm}`;
}

function safeFilePart(value: string): string {
  const trimmed = value.trim().slice(0, 60);
  const replaced = trimmed
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, " ");
  return replaced.trim().replace(/\s/g, "-") || "chat";
}

function buildHeader(params: {
  title: string;
  sessionId: string;
  exportedAt: Date;
}): string {
  return [
    "UniFlow AI Chat Export",
    `Title: ${params.title}`,
    `SessionId: ${params.sessionId}`,
    `ExportedAt: ${params.exportedAt.toISOString()}`,
    "",
  ].join("\n");
}

export function buildChatExportTxt(params: {
  title: string;
  sessionId: string;
  messages: Message[];
  exportedAt?: Date;
}): string {
  const exportedAt = params.exportedAt ?? new Date();

  const lines: string[] = [
    buildHeader({
      title: params.title,
      sessionId: params.sessionId,
      exportedAt,
    }),
  ];

  for (const m of params.messages) {
    const createdAt = m.createdAt instanceof Date ? m.createdAt : new Date();
    const who = m.role.toUpperCase();
    lines.push(`[${formatLocalTimestamp(createdAt)}] ${who}:`);
    lines.push(String(m.content ?? "").trimEnd());
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function buildChatExportMarkdown(params: {
  title: string;
  sessionId: string;
  messages: Message[];
  exportedAt?: Date;
}): string {
  const exportedAt = params.exportedAt ?? new Date();

  const out: string[] = [
    `# UniFlow AI Chat Export`,
    `- **Title:** ${params.title}`,
    `- **SessionId:** ${params.sessionId}`,
    `- **ExportedAt:** ${exportedAt.toISOString()}`,
    "",
  ];

  for (const m of params.messages) {
    const createdAt = m.createdAt instanceof Date ? m.createdAt : new Date();
    const ts = formatLocalTimestamp(createdAt);
    out.push(`## ${m.role === "user" ? "User" : "Assistant"} — ${ts}`);
    out.push("");

    const content = String(m.content ?? "").trimEnd();
    // Preserve code blocks / newlines by emitting as-is.
    out.push(content.length > 0 ? content : "(empty)");
    out.push("");
  }

  return out.join("\n").trimEnd() + "\n";
}

export function downloadTextFile(params: {
  filename: string;
  content: string;
  mime: string;
}) {
  const blob = new Blob([params.content], { type: params.mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = params.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Let the click start before revoke
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export function buildChatExportFilename(params: {
  title: string;
  exportedAt?: Date;
  ext: "txt" | "md";
}): string {
  const exportedAt = params.exportedAt ?? new Date();
  const yyyy = exportedAt.getFullYear();
  const mm = pad2(exportedAt.getMonth() + 1);
  const dd = pad2(exportedAt.getDate());
  const hh = pad2(exportedAt.getHours());
  const mi = pad2(exportedAt.getMinutes());

  const titlePart = safeFilePart(params.title);
  return `uniflow-chat-${titlePart}-${yyyy}-${mm}-${dd}-${hh}-${mi}.${params.ext}`;
}
