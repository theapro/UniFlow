-- Widen role enums.

-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('STUDENT', 'TEACHER', 'STAFF', 'MANAGER', 'ADMIN') NOT NULL;

-- AlterTable
ALTER TABLE `AiUsageLog` MODIFY `role` ENUM('STUDENT', 'TEACHER', 'STAFF', 'MANAGER', 'ADMIN') NULL;

-- AlterTable
ALTER TABLE `RolePermission` MODIFY `role` ENUM('STUDENT', 'TEACHER', 'STAFF', 'MANAGER', 'ADMIN') NOT NULL;
