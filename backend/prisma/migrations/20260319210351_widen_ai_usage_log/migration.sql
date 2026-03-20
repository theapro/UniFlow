-- AlterTable
ALTER TABLE `aiusagelog` MODIFY `userMessage` LONGTEXT NOT NULL,
    MODIFY `assistantMessage` LONGTEXT NULL,
    MODIFY `error` LONGTEXT NULL;
