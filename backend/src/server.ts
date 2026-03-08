import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { StudentsSheetsWorker } from "./services/students-sheets/StudentsSheetsWorker";
import { TeachersSheetsWorker } from "./services/teachers-sheets/TeachersSheetsWorker";
import { AttendanceSheetsWorker } from "./services/attendance-sheets/AttendanceSheetsWorker";
import { logError, logInfo } from "./utils/logger";

process.on("unhandledRejection", (reason) => {
  logError("Process", "unhandledRejection", { reason });
});

process.on("uncaughtException", (err) => {
  logError("Process", "uncaughtException", err);
});

app.listen(env.port, () => {
  logInfo("Server", "listening", {
    port: env.port,
    nodeEnv: env.nodeEnv,
  });
});

if (env.studentsSheetsWorkerEnabled) {
  const worker = new StudentsSheetsWorker(prisma, {
    intervalMs: env.studentsSheetsWorkerIntervalMs,
  });

  worker.start().catch((e) => {
    logError("StudentsSheetsWorker", "failed to start", e);
  });
}

if (env.teachersSheetsWorkerEnabled) {
  const worker = new TeachersSheetsWorker(prisma, {
    intervalMs: env.teachersSheetsWorkerIntervalMs,
  });

  worker.start().catch((e) => {
    logError("TeachersSheetsWorker", "failed to start", e);
  });
}

if (env.attendanceSheetsWorkerEnabled) {
  const worker = new AttendanceSheetsWorker(prisma, {
    intervalMs: env.attendanceSheetsWorkerIntervalMs,
  });

  worker.start().catch((e) => {
    logError("AttendanceSheetsWorker", "failed to start", e);
  });
}
