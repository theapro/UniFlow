-- CreateTable
CREATE TABLE "TeachersSheetsWorkerState" (
    "key" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachersSheetsWorkerState_pkey" PRIMARY KEY ("key")
);
