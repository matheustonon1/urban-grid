import { createHmac } from "crypto";

import { prisma } from "@/lib/prisma";

import { excedeuLimitePorIp } from "./rateLimitMemoria";

// Limite de abuso COMPARTILHADO entre instâncias, guardado no banco (tabela LimiteAbuso).
//
// O limite em memória (rateLimitMemoria) vale por processo: em serverless cada função tem o seu
// contador, e quem martela o botão cai em instâncias diferentes e nunca chega ao limite. Para o
// que manda e-mail (cota do provedor, caixa de terceiros) ou mexe em credencial - redefinir senha,
// reenviar verificação, trocar e-mail, novo link de convite - o contador precisa ser de todas.
// Para o que só lê e é chamado a cada tecla (/api/cep, /api/cidades) o banco seria custo sem ganho,
// e esses seguem em memória.
//
// A chave vira um HMAC (AUTH_SECRET): a tabela nunca guarda IP nem e-mail em claro.

const VARREDURA_PROBABILIDADE = 0.05;
const VARREDURA_LOTE = 200;

function idDaChave(escopo: string, chave: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`${escopo}:${chave}`).digest("hex");
}

// Retorna true se a chave excedeu o limite de chamadas na janela. Sem chave identificável não há
// como limitar e deixa passar (mesmo critério do limite em memória). Se o banco falhar, cai para o
// contador em memória em vez de bloquear (ou liberar de vez) a ação: o limite por instância é
// melhor que nenhum, e uma falha do limitador não pode derrubar o envio legítimo.
export async function excedeuLimiteCompartilhado(
  escopo: string,
  chave: string | null,
  limite: number,
  janelaMs: number
): Promise<boolean> {
  if (!chave) return false;

  const id = idDaChave(escopo, chave);
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + janelaMs);

  try {
    // Incremento e leitura numa transação: o INSERT ... ON DUPLICATE KEY trava a linha até o
    // commit, então cada chamada lê exatamente o próprio número (1, 2, 3...). Em instruções
    // soltas, uma chamada podia ler a contagem de outra que incrementou depois dela e ser
    // barrada sem ter passado do limite - nunca deixaria passar a mais, mas barraria de menos.
    //
    // O vencimento é tratado DEPOIS do incremento (e não por um DELETE antes dele): o DELETE de
    // uma chave que não existe toma um gap lock, e dois pedidos simultâneos da mesma chave nova
    // se travariam em deadlock ao inserir.
    const contagem = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO LimiteAbuso (id, contagem, expiraEm) VALUES (${id}, 1, ${expiraEm})
        ON DUPLICATE KEY UPDATE contagem = contagem + 1`;
      const [linha] = await tx.$queryRaw<{ contagem: number; expiraEm: Date }[]>`
        SELECT contagem, expiraEm FROM LimiteAbuso WHERE id = ${id}`;

      if (linha && linha.expiraEm <= agora) {
        // A janela anterior já tinha vencido: este pedido abre uma nova, valendo 1.
        await tx.$executeRaw`UPDATE LimiteAbuso SET contagem = 1, expiraEm = ${expiraEm} WHERE id = ${id}`;
        return 1;
      }
      return Number(linha?.contagem ?? 1);
    });

    if (Math.random() < VARREDURA_PROBABILIDADE) {
      // Varre aos poucos o que já venceu: sem isto a tabela só cresceria.
      await prisma.$executeRaw`DELETE FROM LimiteAbuso WHERE expiraEm <= ${agora} LIMIT ${VARREDURA_LOTE}`;
    }

    return contagem > limite;
  } catch (erro) {
    console.error("Falha no limite compartilhado; usando o contador em memória:", erro);
    return excedeuLimitePorIp(escopo, chave, limite, janelaMs);
  }
}
