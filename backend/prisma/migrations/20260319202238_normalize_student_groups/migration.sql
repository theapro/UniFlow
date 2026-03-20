/*
  Warnings:

  - You are about to drop the column `cohort` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `student` table. All the data in the column will be lost.
  - You are about to drop the column `teacherIds` on the `student` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `student` DROP FOREIGN KEY `Student_groupId_fkey`;

-- DropIndex
DROP INDEX `Student_groupId_fkey` ON `student`;

-- AlterTable
ALTER TABLE `student` DROP COLUMN `cohort`,
    DROP COLUMN `group`,
    DROP COLUMN `groupId`,
    DROP COLUMN `teacherIds`,
    ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `StudentGroup` (
    `id` CHAR(36) NOT NULL,
    `studentId` CHAR(36) NOT NULL,
    `groupId` CHAR(36) NOT NULL,
    `joinedAt` DATE NULL,
    `leftAt` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudentGroup_studentId_idx`(`studentId`),
    INDEX `StudentGroup_groupId_idx`(`groupId`),
    UNIQUE INDEX `StudentGroup_studentId_groupId_key`(`studentId`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StudentGroup` ADD CONSTRAINT `StudentGroup_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentGroup` ADD CONSTRAINT `StudentGroup_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
