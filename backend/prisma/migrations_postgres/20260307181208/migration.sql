/*
  Warnings:

  - You are about to drop the column `date` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `subjectId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `AttendanceSheetsSyncLog` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAttendance` on the `AttendanceSheetsSyncState` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lessonId,studentId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lessonId` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_subjectId_fkey";

-- DropIndex
DROP INDEX "Attendance_groupId_subjectId_studentId_date_key";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "date",
DROP COLUMN "groupId",
DROP COLUMN "subjectId",
ADD COLUMN     "lessonId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceSheetsSyncLog" DROP COLUMN "date",
ADD COLUMN     "lessonId" UUID;

-- AlterTable
ALTER TABLE "AttendanceSheetsSyncState" DROP COLUMN "syncedAttendance",
ADD COLUMN     "syncedLessons" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT,
    "groupId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_lessonId_studentId_key" ON "Attendance"("lessonId", "studentId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
