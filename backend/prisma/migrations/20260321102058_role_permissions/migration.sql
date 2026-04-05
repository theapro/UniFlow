-- Create RBAC tables.

-- CreateTable
CREATE TABLE `Permission` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Permission_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` CHAR(36) NOT NULL,
    `role` ENUM('STUDENT', 'TEACHER', 'ADMIN') NOT NULL,
    `permission` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `RolePermission_role_permission_key`(`role`, `permission`),
    INDEX `RolePermission_role_idx`(`role`),
    INDEX `RolePermission_permission_idx`(`permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permission_fkey` FOREIGN KEY (`permission`) REFERENCES `Permission`(`name`) ON DELETE CASCADE ON UPDATE CASCADE;
