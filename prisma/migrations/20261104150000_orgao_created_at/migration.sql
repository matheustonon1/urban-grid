-- AlterTable: desde quando o órgão existe. As linhas que já existem recebem a data desta migration
-- (DEFAULT na hora de adicionar a coluna), de propósito: o índice de reputação passa a contar a
-- reclamação sem resposta só a partir daqui, sem condenar o passado.
ALTER TABLE `Orgao` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
