-- AlterTable
ALTER TABLE `ai_avatar` ADD COLUMN `inputLanguage` ENUM('UZ', 'EN', 'JP') NOT NULL DEFAULT 'UZ',
    ADD COLUMN `outputLanguage` ENUM('UZ', 'EN', 'JP') NOT NULL DEFAULT 'UZ';

-- AlterTable
ALTER TABLE `announcements` ADD COLUMN `universityId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `universities` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `universities_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diplomas` (
    `id` CHAR(36) NOT NULL,
    `universityId` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `diplomas_universityId_idx`(`universityId`),
    UNIQUE INDEX `diplomas_universityId_name_key`(`universityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `university_departments` (
    `id` CHAR(36) NOT NULL,
    `universityId` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `university_departments_universityId_idx`(`universityId`),
    UNIQUE INDEX `university_departments_universityId_name_key`(`universityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `specialties` (
    `id` CHAR(36) NOT NULL,
    `departmentId` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `specialties_departmentId_idx`(`departmentId`),
    UNIQUE INDEX `specialties_departmentId_name_key`(`departmentId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fees` (
    `id` CHAR(36) NOT NULL,
    `universityId` CHAR(36) NOT NULL,
    `specialtyId` CHAR(36) NULL,
    `title` VARCHAR(180) NOT NULL,
    `amount` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'UZS',
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `fees_universityId_idx`(`universityId`),
    INDEX `fees_specialtyId_idx`(`specialtyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `facilities` (
    `id` CHAR(36) NOT NULL,
    `universityId` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `facilities_universityId_idx`(`universityId`),
    UNIQUE INDEX `facilities_universityId_name_key`(`universityId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `announcements_universityId_idx` ON `announcements`(`universityId`);

-- AddForeignKey
ALTER TABLE `diplomas` ADD CONSTRAINT `diplomas_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `university_departments` ADD CONSTRAINT `university_departments_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `specialties` ADD CONSTRAINT `specialties_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `university_departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fees` ADD CONSTRAINT `fees_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fees` ADD CONSTRAINT `fees_specialtyId_fkey` FOREIGN KEY (`specialtyId`) REFERENCES `specialties`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `facilities` ADD CONSTRAINT `facilities_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `universities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_universityId_fkey` FOREIGN KEY (`universityId`) REFERENCES `universities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
