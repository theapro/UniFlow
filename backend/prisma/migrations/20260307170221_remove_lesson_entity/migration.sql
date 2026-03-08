/*
  Warnings:

  - You are about to drop the column `lessonId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `lessonId` on the `AttendanceSheetsSyncLog` table. All the data in the column will be lost.
  - You are about to drop the column `syncedLessons` on the `AttendanceSheetsSyncState` table. All the data in the column will be lost.
  - You are about to drop the `Lesson` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[groupId,subjectId,studentId,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `date` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subjectId` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_teacherId_fkey";

-- DropIndex
DROP INDEX "Attendance_lessonId_studentId_key";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "lessonId",
ADD COLUMN     "date" DATE NOT NULL,
ADD COLUMN     "groupId" UUID NOT NULL,
ADD COLUMN     "subjectId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceSheetsSyncLog" DROP COLUMN "lessonId",
ADD COLUMN     "date" DATE;

-- AlterTable
ALTER TABLE "AttendanceSheetsSyncState" DROP COLUMN "syncedLessons",
ADD COLUMN     "syncedAttendance" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Lesson";

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_groupId_subjectId_studentId_date_key" ON "Attendance"("groupId", "subjectId", "studentId", "date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
