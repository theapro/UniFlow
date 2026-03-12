-- CreateEnum
CREATE TYPE "SheetsJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "SheetsJob" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SheetsJobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetsJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SheetsJob_status_nextRunAt_idx" ON "SheetsJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "SheetsJob_lockedUntil_idx" ON "SheetsJob"("lockedUntil");
