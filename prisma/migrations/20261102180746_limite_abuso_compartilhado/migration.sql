-- CreateTable
CREATE TABLE `LimiteAbuso` (
    `id` VARCHAR(64) NOT NULL,
    `contagem` INTEGER NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,

    INDEX `LimiteAbuso_expiraEm_idx`(`expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
