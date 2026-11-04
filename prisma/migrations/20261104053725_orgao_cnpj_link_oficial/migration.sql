-- AlterTable
ALTER TABLE `Orgao` ADD COLUMN `cnpj` VARCHAR(14) NULL,
    ADD COLUMN `linkOficial` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `SolicitacaoOrgao` ADD COLUMN `cnpj` VARCHAR(14) NULL,
    ADD COLUMN `linkOficial` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `Orgao_cnpj_idx` ON `Orgao`(`cnpj`);

-- CreateIndex
CREATE INDEX `SolicitacaoOrgao_cnpj_idx` ON `SolicitacaoOrgao`(`cnpj`);
