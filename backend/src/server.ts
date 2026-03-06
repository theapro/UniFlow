import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { StudentsSheetsWorker } from "./services/students-sheets/StudentsSheetsWorker";

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${env.port}`);
});

if (env.studentsSheetsWorkerEnabled) {
  const worker = new StudentsSheetsWorker(prisma, {
    intervalMs: env.studentsSheetsWorkerIntervalMs,
  });

  worker.start().catch((e) => {
    console.error("[StudentsSheetsWorker] failed to start", e);
  });
}
