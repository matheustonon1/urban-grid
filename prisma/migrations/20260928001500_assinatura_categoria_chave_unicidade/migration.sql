-- Solta as FKs antes de mexer nos índices - o índice único que vamos
-- substituir também servia (efeito colateral) de índice de apoio pra elas,
-- e o MySQL recusa derrubar um índice em uso por FK. Sem isso, teria que
-- descobrir manualmente qual índice cobre qual FK; assim não importa.
ALTER TABLE `AssinaturaCidade` DROP FOREIGN KEY `AssinaturaCidade_userId_fkey`;
ALTER TABLE `AssinaturaCidade` DROP FOREIGN KEY `AssinaturaCidade_cidadeId_fkey`;
ALTER TABLE `AssinaturaCidade` DROP FOREIGN KEY `AssinaturaCidade_categoriaId_fkey`;

-- AlterTable
ALTER TABLE `AssinaturaCidade` ADD COLUMN `categoriaChave` VARCHAR(191) NOT NULL DEFAULT '__todas__';

-- Backfill: linhas com categoria específica levam o próprio categoriaId
-- como chave; as que já tinham categoriaId nulo (todas as categorias)
-- ficam com o default '__todas__' definido acima.
UPDATE `AssinaturaCidade` SET `categoriaChave` = `categoriaId` WHERE `categoriaId` IS NOT NULL;

-- DropIndex
DROP INDEX `AssinaturaCidade_userId_cidadeId_categoriaId_key` ON `AssinaturaCidade`;

-- CreateIndex
CREATE UNIQUE INDEX `AssinaturaCidade_userId_cidadeId_categoriaChave_key` ON `AssinaturaCidade`(`userId`, `cidadeId`, `categoriaChave`);

-- Recria as FKs
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_cidadeId_fkey` FOREIGN KEY (`cidadeId`) REFERENCES `Cidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AssinaturaCidade` ADD CONSTRAINT `AssinaturaCidade_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `Categoria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
