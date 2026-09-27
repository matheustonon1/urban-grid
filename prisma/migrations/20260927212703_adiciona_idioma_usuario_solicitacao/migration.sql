-- AlterTable
ALTER TABLE `SolicitacaoOrgao` ADD COLUMN `idioma` VARCHAR(5) NOT NULL DEFAULT 'pt-BR';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `idioma` VARCHAR(5) NOT NULL DEFAULT 'pt-BR';
