import type { AcaoAuditoria, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Registro de quem fez o quê nas ações que mudam acesso ou decidem em nome da
// plataforma (modelo RegistroAuditoria). Sem isto, mudar um papel ou banir uma conta
// deixava como único rastro a própria mudança - nem quem fez, nem o valor anterior.
//
// Aceita o cliente de uma transação: nas ações de privilégio (papel, banimento) o
// registro entra NA MESMA transação da mudança, então não existe mudança sem registro
// nem registro de uma mudança que não aconteceu.

type Cliente = Pick<typeof prisma, "registroAuditoria">;

export interface DadosAuditoria {
  acao: AcaoAuditoria;
  atorId: string;
  // Conta afetada, quando a ação é sobre uma pessoa.
  alvoUserId?: string;
  // Outros alvos: órgão, solicitação. Sem FK (desenho polimórfico, como LogModeracao).
  alvoTipo?: "ORGAO" | "SOLICITACAO_ORGAO" | "SOLICITACAO_CIDADE";
  alvoId?: string;
  // Só o que explica a mudança e não é dado pessoal (papel anterior e novo, duração).
  detalhes?: Prisma.InputJsonObject;
}

export function registrarAuditoria(dados: DadosAuditoria, cliente: Cliente = prisma) {
  return cliente.registroAuditoria.create({
    data: {
      acao: dados.acao,
      atorId: dados.atorId,
      alvoUserId: dados.alvoUserId,
      alvoTipo: dados.alvoTipo,
      alvoId: dados.alvoId,
      detalhes: dados.detalhes,
    },
  });
}
