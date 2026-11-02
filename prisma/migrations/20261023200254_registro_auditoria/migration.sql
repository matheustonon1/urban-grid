-- CreateTable
CREATE TABLE `RegistroAuditoria` (
    `id` VARCHAR(191) NOT NULL,
    `acao` ENUM('PAPEL_ALTERADO', 'BANIMENTO_APLICADO', 'BANIMENTO_REVERTIDO', 'ORGAO_DESATIVADO', 'ORGAO_REATIVADO', 'SOLICITACAO_ORGAO_APROVADA', 'SOLICITACAO_ORGAO_REJEITADA', 'SOLICITACAO_CIDADE_APROVADA', 'SOLICITACAO_CIDADE_REJEITADA') NOT NULL,
    `atorId` VARCHAR(191) NULL,
    `alvoUserId` VARCHAR(191) NULL,
    `alvoTipo` VARCHAR(32) NULL,
    `alvoId` VARCHAR(191) NULL,
    `detalhes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RegistroAuditoria_createdAt_idx`(`createdAt`),
    INDEX `RegistroAuditoria_acao_createdAt_idx`(`acao`, `createdAt`),
    INDEX `RegistroAuditoria_alvoUserId_idx`(`alvoUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RegistroAuditoria` ADD CONSTRAINT `RegistroAuditoria_atorId_fkey` FOREIGN KEY (`atorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistroAuditoria` ADD CONSTRAINT `RegistroAuditoria_alvoUserId_fkey` FOREIGN KEY (`alvoUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
