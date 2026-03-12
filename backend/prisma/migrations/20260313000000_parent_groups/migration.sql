-- CreateTable
CREATE TABLE `ParentGroup` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ParentGroup_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Group` ADD COLUMN `parentGroupId` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `Group_parentGroupId_idx` ON `Group`(`parentGroupId`);

-- AddForeignKey
ALTER TABLE `Group` ADD CONSTRAINT `Group_parentGroupId_fkey` FOREIGN KEY (`parentGroupId`) REFERENCES `ParentGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
