-- AlterTable
ALTER TABLE `teacherssheetssynclog` MODIFY `message` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `teacherssheetssyncstate` MODIFY `lastError` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `teacherssheetsworkerstate` MODIFY `lastError` LONGTEXT NULL;
