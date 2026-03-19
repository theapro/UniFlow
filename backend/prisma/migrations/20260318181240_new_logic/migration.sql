-- CreateTable
CREATE TABLE `SheetsSettings` (
    `key` VARCHAR(191) NOT NULL,
    `studentsSpreadsheetId` VARCHAR(191) NULL,
    `teachersSpreadsheetId` VARCHAR(191) NULL,
    `attendanceSpreadsheetId` VARCHAR(191) NULL,
    `gradesSpreadsheetId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
