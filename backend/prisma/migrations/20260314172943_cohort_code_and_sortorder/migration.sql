/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Cohort` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Cohort` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX `Cohort_year_key` ON `cohort`;

-- AlterTable
ALTER TABLE `cohort` ADD COLUMN `code` VARCHAR(191) NULL,
  ADD COLUMN `sortOrder` INTEGER NOT NULL DEFAULT 0,
  MODIFY `year` INTEGER NULL;

-- Backfill: existing rows get code from legacy year
UPDATE `cohort`
SET `code` = CAST(`year` AS CHAR)
WHERE `code` IS NULL AND `year` IS NOT NULL;

-- If any legacy rows still have NULL code (should be rare), set a stable fallback
UPDATE `cohort`
SET `code` = CONCAT('legacy-', `id`)
WHERE `code` IS NULL;

-- Enforce NOT NULL after backfill
ALTER TABLE `cohort` MODIFY `code` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Cohort_code_key` ON `Cohort`(`code`);

-- CreateIndex
CREATE INDEX `Cohort_sortOrder_idx` ON `Cohort`(`sortOrder`);
