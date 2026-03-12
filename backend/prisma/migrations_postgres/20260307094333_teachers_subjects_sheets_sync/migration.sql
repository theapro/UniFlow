/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TeachersSheetsSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TeachersSheetsLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "TeachersSheetsLogDirection" AS ENUM ('SHEETS_TO_DB');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "email" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sheetCreatedAt" TIMESTAMP(3),
ADD COLUMN     "sheetUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "telegram" TEXT;

-- CreateTable
CREATE TABLE "TeachersSheetsSyncState" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "lastRunId" TEXT,
    "lastStatus" "TeachersSheetsSyncStatus",
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "detectedSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncedTeachers" INTEGER NOT NULL DEFAULT 0,
    "spreadsheetRows" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachersSheetsSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachersSheetsSyncLog" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" "TeachersSheetsLogLevel" NOT NULL DEFAULT 'INFO',
    "direction" "TeachersSheetsLogDirection" NOT NULL,
    "action" TEXT NOT NULL,
    "sheetTitle" TEXT,
    "teacherId" UUID,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachersSheetsSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SubjectToTeacher" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_SubjectToTeacher_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeachersSheetsSyncState_spreadsheetId_key" ON "TeachersSheetsSyncState"("spreadsheetId");

-- CreateIndex
CREATE INDEX "TeachersSheetsSyncLog_spreadsheetId_createdAt_idx" ON "TeachersSheetsSyncLog"("spreadsheetId", "createdAt");

-- CreateIndex
CREATE INDEX "TeachersSheetsSyncLog_runId_createdAt_idx" ON "TeachersSheetsSyncLog"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "_SubjectToTeacher_B_index" ON "_SubjectToTeacher"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- AddForeignKey
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubjectToTeacher" ADD CONSTRAINT "_SubjectToTeacher_B_fkey" FOREIGN KEY ("B") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
