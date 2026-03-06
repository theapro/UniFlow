-- CreateEnum
CREATE TYPE "StudentsSheetsOutboxType" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "StudentsSheetsOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "StudentsSheetsLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "StudentsSheetsLogDirection" AS ENUM ('SHEETS_TO_DB', 'DB_TO_SHEETS', 'WORKER');

-- AlterTable
ALTER TABLE "StudentsSheetsSyncState" ADD COLUMN     "lastRunId" TEXT,
ADD COLUMN     "spreadsheetRows" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StudentsSheetsRowState" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetTitle" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentsSheetsRowState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentsSheetsOutboxEvent" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "StudentsSheetsOutboxType" NOT NULL,
    "targetSheetTitle" TEXT,
    "payload" JSONB,
    "status" "StudentsSheetsOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentsSheetsOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentsSheetsSyncLog" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" "StudentsSheetsLogLevel" NOT NULL DEFAULT 'INFO',
    "direction" "StudentsSheetsLogDirection" NOT NULL,
    "action" TEXT NOT NULL,
    "sheetTitle" TEXT,
    "studentId" UUID,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentsSheetsSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentsSheetsWorkerState" (
    "key" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentsSheetsWorkerState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "StudentsSheetsRowState_spreadsheetId_sheetTitle_idx" ON "StudentsSheetsRowState"("spreadsheetId", "sheetTitle");

-- CreateIndex
CREATE INDEX "StudentsSheetsRowState_studentId_idx" ON "StudentsSheetsRowState"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentsSheetsRowState_spreadsheetId_sheetTitle_studentId_key" ON "StudentsSheetsRowState"("spreadsheetId", "sheetTitle", "studentId");

-- CreateIndex
CREATE INDEX "StudentsSheetsOutboxEvent_status_nextAttemptAt_idx" ON "StudentsSheetsOutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentsSheetsOutboxEvent_spreadsheetId_studentId_key" ON "StudentsSheetsOutboxEvent"("spreadsheetId", "studentId");

-- CreateIndex
CREATE INDEX "StudentsSheetsSyncLog_spreadsheetId_createdAt_idx" ON "StudentsSheetsSyncLog"("spreadsheetId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentsSheetsSyncLog_runId_createdAt_idx" ON "StudentsSheetsSyncLog"("runId", "createdAt");
