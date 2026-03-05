import "dotenv/config";
import { AiModality, PrismaClient } from "@prisma/client";
import { GroqChatService } from "../services/ai/GroqChatService";

const prisma = new PrismaClient();
const groq = new GroqChatService();

async function testChatModel(model: string): Promise<{
  ok: boolean;
  ms: number;
  preview: string;
  error?: string;
  retryable?: boolean;
  rawLen?: number;
  thinkOnly?: boolean;
}> {
  const startedAt = Date.now();
  let full = "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    await groq.streamChat({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Reply in plain text. Do not include <think> tags or hidden reasoning.",
        },
        { role: "user", content: "ping" },
      ],
      callbacks: {
        onDelta: (d) => {
          full += d;
          if (full.length > 4000) {
            full = full.slice(0, 4000);
          }
        },
      },
      abortSignal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = /\b503\b|over capacity|rate limit|timeout/i.test(msg);
    return {
      ok: false,
      ms: Date.now() - startedAt,
      preview: "",
      error: msg,
      retryable,
    };
  } finally {
    clearTimeout(timeout);
  }

  const ms = Date.now() - startedAt;
  const preview = full
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);

  const trimmedRaw = full.trim();
  const thinkOnly = trimmedRaw.length > 0 && preview.length === 0;
  return {
    ok: preview.length > 0,
    ms,
    preview,
    rawLen: full.length,
    thinkOnly,
  };
}

async function main() {
  const models = await prisma.aiModel.findMany({
    where: { provider: "groq", isEnabled: true },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  if (models.length === 0) {
    console.error("No AiModel rows found in DB.");
    process.exitCode = 1;
    return;
  }

  console.log(`Found ${models.length} enabled models in DB (provider=groq).`);

  let okCount = 0;
  let failCount = 0;

  for (const m of models) {
    if (m.modality !== AiModality.CHAT) {
      console.log(
        `[SKIP] ${m.displayName} (${m.model}) modality=${m.modality}`,
      );
      continue;
    }

    process.stdout.write(`[TEST] ${m.displayName} (${m.model}) ... `);
    const r = await testChatModel(m.model);

    if (r.ok) {
      okCount += 1;
      console.log(`OK (${r.ms}ms) :: ${r.preview}`);
    } else {
      failCount += 1;
      const extra = r.retryable
        ? " :: RETRYABLE"
        : r.thinkOnly
          ? " :: ONLY_THINK_OUTPUT"
          : r.error
            ? ` :: ${r.error}`
            : "";
      console.log(`FAIL (${r.ms}ms)${extra}`);
    }
  }

  console.log(`\nSummary: ok=${okCount} fail=${failCount}`);
  if (failCount > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
