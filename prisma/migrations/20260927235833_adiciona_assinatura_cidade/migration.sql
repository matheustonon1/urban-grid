-- CreateTable
CREATE TABLE `AssinaturaCidade` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `cidadeId` VARCHAR(191) NOT NULL,
    `categoriaId` VARCHAR(191) NULL,
    `ultimoEnvioEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssinaturaCidade_cidadeId_idx`(`cidadeId`),
    INDEX `AssinaturaCidade_ultimoEnvioEm_idx`(`ultimoEnvioEm`),
    UNIQUE INDEX `AssinaturaCidade_userId_cidadeId_categoriaId_key`(`userId`, `cidadeId`, `categoriaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_cidadeId_fkey` FOREIGN KEY (`cidadeId`) REFERENCES `Cidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
