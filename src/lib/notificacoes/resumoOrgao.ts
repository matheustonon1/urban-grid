import { prisma } from "@/lib/prisma";
import { enviarEmailResumoOrgao } from "@/lib/email";
import { montarUrl } from "@/lib/util/url";
import { idiomaOuPadrao } from "@/i18n/config";
import { filtroSemRespostaDoOrgao } from "@/lib/orgaos/escopoOrgao";
import { limiteDoPrazoSemResposta, PRAZO_SEM_RESPOSTA_DIAS } from "@/lib/orgaos/prazoResposta";

import { INTERVALO_MINIMO_RESUMO_MS } from "./resumoSemanal";

// Mesmos tetos do resumo semanal do cidadão (resumoSemanal.ts): o cron roda uma vez por semana,
// então a fila nunca deveria ser grande, e o limite protege de uma reexecução acidental.
const LIMITE_POR_EXECUCAO = 500;
const TAMANHO_DO_LOTE = 10;

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SituacaoDaFila {
  // Abertas e sem nenhuma resposta oficial, no escopo do órgão (a mesma fila do painel).
  semResposta: number;
  // Dessas, as que chegaram nos últimos 7 dias.
  novas: number;
  // Dessas, as que já passaram do prazo (PRAZO_SEM_RESPOSTA_DIAS) e pesam no índice.
  vencidas: number;
}

type ContaDeOrgao = {
  id: string;
  email: string;
  idioma: string;
  orgao: {
    id: string;
    nome: string;
    cidadeId: string;
    cidade: { nome: string };
    categorias: { id: string }[];
  } | null;
};

async function situacaoDaFila(
  orgao: NonNullable<ContaDeOrgao["orgao"]>,
  agora: Date
): Promise<SituacaoDaFila> {
  // Sem categoria atribuída o órgão atende qualquer uma da cidade (orgaoAtendeCategoria).
  const categoriaIds = orgao.categorias.length > 0 ? orgao.categorias.map((c) => c.id) : null;
  const base = filtroSemRespostaDoOrgao(orgao, categoriaIds);

  const [semResposta, novas, vencidas] = await Promise.all([
    prisma.reclamacao.count({ where: base }),
    prisma.reclamacao.count({
      where: { ...base, publicadaEm: { gt: new Date(agora.getTime() - SETE_DIAS_MS) } },
    }),
    prisma.reclamacao.count({
      where: { ...base, publicadaEm: { lte: limiteDoPrazoSemResposta(agora) } },
    }),
  ]);

  return { semResposta, novas, vencidas };
}

// Resumo semanal da fila de cada conta de órgão: quantas reclamações estão sem resposta, quantas
// chegaram nesta semana e quantas já passaram do prazo. O e-mail só sai quando há algo sem
// resposta (uma fila zerada não merece e-mail), mas a semana é marcada de qualquer jeito, como no
// resumo do cidadão. O aviso em tempo real (sininho) fica em orgaos.ts.
//
// Respeita "Receber notificações por e-mail" (User.notificarPorEmail): o órgão não tem assinatura
// própria, então essa preferência é o botão de desligar. Conta banida, excluída, sem e-mail
// verificado ou de órgão desativado não recebe (não pode agir).
export async function enviarResumosDeOrgaosPendentes(): Promise<{
  processadas: number;
  comConteudo: number;
}> {
  const agora = new Date();
  const limiteUltimoEnvio = new Date(agora.getTime() - INTERVALO_MINIMO_RESUMO_MS);

  const contas: ContaDeOrgao[] = await prisma.user.findMany({
    where: {
      papel: "ORGAO",
      ativo: true,
      emailVerified: { not: null },
      notificarPorEmail: true,
      orgao: { ativo: true },
      AND: [
        { OR: [{ banidoAte: null }, { banidoAte: { lte: agora } }] },
        { OR: [{ ultimoResumoOrgaoEm: null }, { ultimoResumoOrgaoEm: { lte: limiteUltimoEnvio } }] },
      ],
    },
    take: LIMITE_POR_EXECUCAO,
    select: {
      id: true,
      email: true,
      idioma: true,
      orgao: {
        select: {
          id: true,
          nome: true,
          cidadeId: true,
          cidade: { select: { nome: true } },
          categorias: { select: { id: true } },
        },
      },
    },
  });

  // Contas do mesmo órgão compartilham a mesma fila: conta uma vez por execução.
  const situacoes = new Map<string, Promise<SituacaoDaFila>>();
  const situacaoDoOrgao = (orgao: NonNullable<ContaDeOrgao["orgao"]>) => {
    let situacao = situacoes.get(orgao.id);
    if (!situacao) {
      situacao = situacaoDaFila(orgao, agora);
      situacoes.set(orgao.id, situacao);
    }
    return situacao;
  };

  async function processar(conta: ContaDeOrgao): Promise<boolean> {
    let enviou = false;

    if (conta.orgao) {
      try {
        const situacao = await situacaoDoOrgao(conta.orgao);
        if (situacao.semResposta > 0) {
          await enviarEmailResumoOrgao({
            email: conta.email,
            nomeOrgao: conta.orgao.nome,
            nomeCidade: conta.orgao.cidade.nome,
            ...situacao,
            prazoDias: PRAZO_SEM_RESPOSTA_DIAS,
            url: montarUrl("/orgao"),
            locale: idiomaOuPadrao(conta.idioma),
          });
          enviou = true;
        }
      } catch (erro) {
        // Uma conta com defeito não trava as outras da fila.
        console.error("Falha ao enviar o resumo semanal do órgão:", erro);
      }
    }

    try {
      await prisma.user.update({ where: { id: conta.id }, data: { ultimoResumoOrgaoEm: agora } });
    } catch (erro) {
      // Sem a marca a conta volta na próxima execução; o que não pode é derrubar o lote.
      console.error("Falha ao marcar o resumo semanal do órgão:", erro);
    }
    return enviou;
  }

  let comConteudo = 0;
  for (let inicio = 0; inicio < contas.length; inicio += TAMANHO_DO_LOTE) {
    const lote = contas.slice(inicio, inicio + TAMANHO_DO_LOTE);
    const resultados = await Promise.all(lote.map(processar));
    comConteudo += resultados.filter(Boolean).length;
  }

  return { processadas: contas.length, comConteudo };
}
