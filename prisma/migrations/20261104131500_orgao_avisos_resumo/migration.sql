-- AlterTable: aviso em tempo real para a conta de órgão (valor novo no fim do enum: seguro, nada é
-- removido nem renomeado).
ALTER TABLE `Notificacao` MODIFY `tipo` ENUM('RECLAMACAO_PUBLICADA', 'RECLAMACAO_REJEITADA', 'RESPOSTA_OFICIAL', 'MUDANCA_STATUS', 'NOVO_COMENTARIO', 'PEDIDO_AVALIACAO', 'ATIVIDADE_SUSPEITA', 'CONTA_SEGURANCA', 'NOVA_RECLAMACAO_NA_FILA') NOT NULL;

-- AlterTable: quando o resumo semanal da fila do órgão foi processado para a conta (NULL = nunca).
ALTER TABLE `User` ADD COLUMN `ultimoResumoOrgaoEm` DATETIME(3) NULL;
