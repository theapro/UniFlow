/*
  Warnings:

  - You are about to drop the column `studentNo` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `SheetsInboundEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SheetsJob` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[studentNumber]` on the table `Student` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'GRADUATED', 'DROPPED');

-- CreateEnum
CREATE TYPE "StudentsSheetsSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- DropIndex
DROP INDEX "Student_studentNo_key";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "cohortId" UUID;

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "studentNo",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "parentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "studentNumber" TEXT,
ADD COLUMN     "teacherIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "SheetsInboundEvent";

-- DropTable
DROP TABLE "SheetsJob";

-- DropEnum
DROP TYPE "SheetsInboundResult";

-- DropEnum
DROP TYPE "SheetsJobStatus";

-- CreateTable
CREATE TABLE "Cohort" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentsSheetsSyncState" (
    "id" UUID NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "lastStatus" "StudentsSheetsSyncStatus",
    "lastSyncAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "detectedGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncedStudents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentsSheetsSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_year_key" ON "Cohort"("year");

-- CreateIndex
CREATE UNIQUE INDEX "StudentsSheetsSyncState_spreadsheetId_key" ON "StudentsSheetsSyncState"("spreadsheetId");

-- CreateIndex
CREATE INDEX "Group_cohortId_idx" ON "Group"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
