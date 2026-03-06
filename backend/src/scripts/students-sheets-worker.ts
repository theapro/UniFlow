import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { StudentsSheetsWorker } from "../services/students-sheets/StudentsSheetsWorker";

async function main() {
  const intervalMs = env.studentsSheetsWorkerIntervalMs;
  const worker = new StudentsSheetsWorker(prisma, { intervalMs });

  // eslint-disable-next-line no-console
  console.log("[StudentsSheetsWorker] starting", { intervalMs });

  await worker.start();

  // Keep process alive
  process.stdin.resume();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[StudentsSheetsWorker] fatal", e);
  process.exitCode = 1;
});
