import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { TeachersSheetsWorker } from "../services/teachers-sheets/TeachersSheetsWorker";

async function main() {
  const intervalMs = env.teachersSheetsWorkerIntervalMs || 60000;
  const worker = new TeachersSheetsWorker(prisma, { intervalMs });

  // eslint-disable-next-line no-console
  console.log("[TeachersSheetsWorker] starting", { intervalMs });

  await worker.start();

  // Keep process alive
  process.stdin.resume();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[TeachersSheetsWorker] fatal", e);
  process.exitCode = 1;
});
