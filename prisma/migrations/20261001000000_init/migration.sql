-- CreateTable
CREATE TABLE `households` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `household_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `idx_users_household`(`household_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(36) NOT NULL,
    `household_id` VARCHAR(36) NOT NULL,
    `payer_id` VARCHAR(36) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount_in_paise` INTEGER NOT NULL,
    `expense_type` ENUM('SHARED', 'PERSONAL', 'CUSTOM') NOT NULL DEFAULT 'SHARED',
    `expense_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_expenses_tenant_history`(`household_id`, `is_deleted`, `expense_date`),
    INDEX `idx_expenses_payer`(`payer_id`, `is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_splits` (
    `id` VARCHAR(36) NOT NULL,
    `expense_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `amount_in_paise` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_splits_user`(`user_id`, `amount_in_paise`),
    UNIQUE INDEX `uniq_splits_expense_user`(`expense_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settlements` (
    `id` VARCHAR(36) NOT NULL,
    `household_id` VARCHAR(36) NOT NULL,
    `payer_id` VARCHAR(36) NOT NULL,
    `receiver_id` VARCHAR(36) NOT NULL,
    `amount_in_paise` INTEGER NOT NULL,
    `settlement_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(255) NULL,
    `idempotency_key` VARCHAR(64) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settlements_idempotency_key_key`(`idempotency_key`),
    INDEX `idx_settlements_tenant_history`(`household_id`, `is_deleted`, `settlement_date`),
    INDEX `idx_settlements_payer`(`payer_id`, `is_deleted`),
    INDEX `idx_settlements_receiver`(`receiver_id`, `is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_payer_id_fkey` FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_splits` ADD CONSTRAINT `expense_splits_expense_id_fkey` FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expense_splits` ADD CONSTRAINT `expense_splits_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_household_id_fkey` FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_payer_id_fkey` FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `settlements` ADD CONSTRAINT `settlements_receiver_id_fkey` FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
