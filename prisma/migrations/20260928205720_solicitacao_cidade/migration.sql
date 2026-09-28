-- CreateTable
CREATE TABLE `SolicitacaoCidade` (
    `id` VARCHAR(191) NOT NULL,
    `nomeCidade` VARCHAR(191) NOT NULL,
    `uf` VARCHAR(2) NOT NULL,
    `nomeSolicitante` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `criadoDeIp` VARCHAR(191) NULL,
    `idioma` VARCHAR(5) NOT NULL DEFAULT 'pt-BR',
    `status` ENUM('PENDENTE', 'APROVADA', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
    `motivoRejeicao` TEXT NULL,
    `analisadoPorId` VARCHAR(191) NULL,
    `analisadoEm` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SolicitacaoCidade_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SolicitacaoCidade` ADD CONSTRAINT `SolicitacaoCidade_analisadoPorId_fkey` FOREIGN KEY (`analisadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
