-- CreateEnum
CREATE TYPE "AttendanceSheetsSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AttendanceSheetsLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "AttendanceSheetsLogDirection" AS ENUM ('SHEETS_TO_DB', 'DB_TO_SHEETS', 'WORKER');

-- CreateTable
CREATE TABLE "AttendanceSheetsSyncState" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "lastRunId" TEXT,
    "lastStatus" "AttendanceSheetsSyncStatus",
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "detectedTabs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "processedTabs" INTEGER NOT NULL DEFAULT 0,
    "syncedLessons" INTEGER NOT NULL DEFAULT 0,
    "syncedRecords" INTEGER NOT NULL DEFAULT 0,
    "rosterAdded" INTEGER NOT NULL DEFAULT 0,
    "rosterUpdated" INTEGER NOT NULL DEFAULT 0,
    "spreadsheetRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSheetsSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSheetsSyncLog" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" "AttendanceSheetsLogLevel" NOT NULL DEFAULT 'INFO',
    "direction" "AttendanceSheetsLogDirection" NOT NULL,
    "action" TEXT NOT NULL,
    "sheetTitle" TEXT,
    "groupId" UUID,
    "subjectId" UUID,
    "lessonId" UUID,
    "studentId" UUID,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSheetsSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSheetsWorkerState" (
    "key" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSheetsWorkerState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSheetsSyncState_spreadsheetId_key" ON "AttendanceSheetsSyncState"("spreadsheetId");

-- CreateIndex
CREATE INDEX "AttendanceSheetsSyncLog_spreadsheetId_createdAt_idx" ON "AttendanceSheetsSyncLog"("spreadsheetId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceSheetsSyncLog_runId_createdAt_idx" ON "AttendanceSheetsSyncLog"("runId", "createdAt");
