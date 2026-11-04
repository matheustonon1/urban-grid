-- AlterTable: valor novo no fim do enum (seguro: nada é removido nem renomeado). Um admin redefine o
-- segundo fator de uma conta de órgão que perdeu o aplicativo e os códigos de backup.
ALTER TABLE `RegistroAuditoria` MODIFY `acao` ENUM('PAPEL_ALTERADO', 'BANIMENTO_APLICADO', 'BANIMENTO_REVERTIDO', 'ORGAO_DESATIVADO', 'ORGAO_REATIVADO', 'SOLICITACAO_ORGAO_APROVADA', 'SOLICITACAO_ORGAO_REJEITADA', 'SOLICITACAO_CIDADE_APROVADA', 'SOLICITACAO_CIDADE_REJEITADA', 'DOIS_FATORES_REDEFINIDO') NOT NULL;
