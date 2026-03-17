-- AlterTable
ALTER TABLE `subject` ADD COLUMN `cohortId` CHAR(36) NULL,
    ADD COLUMN `parentGroupId` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `Subject_cohortId_idx` ON `Subject`(`cohortId`);

-- CreateIndex
CREATE INDEX `Subject_parentGroupId_idx` ON `Subject`(`parentGroupId`);

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_cohortId_fkey` FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_parentGroupId_fkey` FOREIGN KEY (`parentGroupId`) REFERENCES `ParentGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
