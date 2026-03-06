-- CreateEnum
CREATE TYPE "StudentsSheetsConflictStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "StudentsSheetsConflictResolution" AS ENUM ('KEEP_SHEET', 'KEEP_DB', 'MERGE');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "cohort" TEXT,
ADD COLUMN     "group" TEXT;

-- CreateTable
CREATE TABLE "StudentsSheetsConflict" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetTitle" TEXT,
    "rowNumber" INTEGER,
    "studentId" UUID,
    "status" "StudentsSheetsConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "StudentsSheetsConflictResolution",
    "message" TEXT,
    "sheetPayload" JSONB,
    "dbPayload" JSONB,
    "baseHash" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentsSheetsConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentsSheetsConflict_spreadsheetId_status_detectedAt_idx" ON "StudentsSheetsConflict"("spreadsheetId", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "StudentsSheetsConflict_studentId_idx" ON "StudentsSheetsConflict"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentsSheetsConflict_spreadsheetId_studentId_key" ON "StudentsSheetsConflict"("spreadsheetId", "studentId");
