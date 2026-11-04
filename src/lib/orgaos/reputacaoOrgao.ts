import { prisma } from "@/lib/prisma";

import { filtroSemRespostaDoOrgao } from "./escopoOrgao";
import { limiteDoPrazoSemResposta } from "./prazoResposta";

const MINIMO_PARA_CLASSIFICAR = 3;

export interface MetricasOrgao {
  totalRespondidas: number;
  resolvidas: number;
  // Reclamações do escopo do órgão publicadas depois de ele existir que passaram do prazo
  // (PRAZO_SEM_RESPOSTA_DIAS) sem NENHUMA resposta oficial, de qualquer órgão.
  semRespostaVencidas: number;
  // O que entra no índice e no mínimo para ganhar selo: respondidas + sem resposta vencidas.
  baseDoIndice: number;
  indiceResolucao: number | null;
  tempoMedioRespostaDias: number | null;
  notaMedia: number | null;
  totalAvaliacoes: number;
}

// O índice de resolução: das reclamações que o órgão respondeu ou deixou passar do prazo sem
// resposta, quantas estão resolvidas. Deixar sem resposta vale o mesmo que responder e não
// resolver; antes, só o que ele respondia entrava na conta, então ignorar uma reclamação não
// custava nada (e um órgão que nunca respondia aparecia como "poucos dados", sem selo ruim).
export function calcularIndiceResolucao({
  resolvidas,
  totalRespondidas,
  semRespostaVencidas,
}: {
  resolvidas: number;
  totalRespondidas: number;
  semRespostaVencidas: number;
}): { base: number; indice: number | null } {
  const base = totalRespondidas + semRespostaVencidas;
  return { base, indice: base === 0 ? null : Math.round((resolvidas / base) * 100) };
}

// Reclamacao não tem orgaoId direto - o vínculo é via RespostaOficial
// (qualquer órgão ativo e habilitado pra categoria da reclamação pode
// responder - ver orgaoAtendeCategoria em lib/orgaos/orgaoCategoria.ts).
// "Respondida por este órgão" = tem ao menos uma RespostaOficial dele; o
// tempo de resposta e a nota são calculados só sobre esse conjunto. O índice de resolução também
// soma o que ficou sem resposta (ver calcularIndiceResolucao).
//
// "Sem resposta vencida" é a fila do painel (lib/orgaos/escopoOrgao.ts: cidade, categorias que o
// órgão atende, fora o que uma conta dele abriu) com três limites:
// - sem NENHUMA resposta oficial: se qualquer órgão responde, a reclamação deixa de contar contra
//   todos os outros que a atendiam (quem respondeu passa a tê-la em "respondidas");
// - publicada há mais de PRAZO_SEM_RESPOSTA_DIAS;
// - publicada depois de o órgão existir (Orgao.createdAt): ele não herda a fila antiga.
// Órgão desativado não acumula: não pode responder.
export async function calcularMetricasOrgao(orgaoId: string): Promise<MetricasOrgao> {
  const agora = new Date();

  const [primeirasRespostas, orgao] = await Promise.all([
    prisma.respostaOficial.groupBy({
      by: ["reclamacaoId"],
      where: { orgaoId },
      _min: { createdAt: true },
    }),
    prisma.orgao.findUnique({
      where: { id: orgaoId },
      select: {
        id: true,
        cidadeId: true,
        ativo: true,
        createdAt: true,
        categorias: { select: { id: true } },
      },
    }),
  ]);

  const semRespostaVencidas =
    orgao && orgao.ativo
      ? await prisma.reclamacao.count({
          where: {
            ...filtroSemRespostaDoOrgao(
              orgao,
              // Sem categoria atribuída o órgão atende qualquer uma (orgaoAtendeCategoria).
              orgao.categorias.length > 0 ? orgao.categorias.map((c) => c.id) : null
            ),
            publicadaEm: { gte: orgao.createdAt, lte: limiteDoPrazoSemResposta(agora) },
          },
        })
      : 0;

  const reclamacaoIds = primeirasRespostas.map((r) => r.reclamacaoId);
  const totalRespondidas = reclamacaoIds.length;

  if (totalRespondidas === 0) {
    const { base, indice } = calcularIndiceResolucao({
      resolvidas: 0,
      totalRespondidas: 0,
      semRespostaVencidas,
    });
    return {
      totalRespondidas: 0,
      resolvidas: 0,
      semRespostaVencidas,
      baseDoIndice: base,
      indiceResolucao: indice,
      tempoMedioRespostaDias: null,
      notaMedia: null,
      totalAvaliacoes: 0,
    };
  }

  const [reclamacoes, avaliacoes] = await Promise.all([
    prisma.reclamacao.findMany({
      where: { id: { in: reclamacaoIds } },
      select: { id: true, publicadaEm: true, status: true },
    }),
    prisma.avaliacao.findMany({
      where: { reclamacaoId: { in: reclamacaoIds } },
      select: { nota: true },
    }),
  ]);

  const resolvidas = reclamacoes.filter((r) => r.status === "RESOLVIDA").length;
  const { base, indice: indiceResolucao } = calcularIndiceResolucao({
    resolvidas,
    totalRespondidas,
    semRespostaVencidas,
  });

  const primeiraRespostaPorReclamacao = new Map(
    primeirasRespostas.map((r) => [r.reclamacaoId, r._min.createdAt!])
  );
  const temposMs = reclamacoes
    .filter((r) => r.publicadaEm)
    .map(
      (r) =>
        primeiraRespostaPorReclamacao.get(r.id)!.getTime() - r.publicadaEm!.getTime()
    )
    .filter((ms) => ms >= 0);
  const tempoMedioRespostaDias =
    temposMs.length > 0
      ? Math.round((temposMs.reduce((a, b) => a + b, 0) / temposMs.length / 86_400_000) * 10) /
        10
      : null;

  const notaMedia =
    avaliacoes.length > 0
      ? Math.round((avaliacoes.reduce((a, b) => a + b.nota, 0) / avaliacoes.length) * 10) / 10
      : null;

  return {
    totalRespondidas,
    resolvidas,
    semRespostaVencidas,
    baseDoIndice: base,
    indiceResolucao,
    tempoMedioRespostaDias,
    notaMedia,
    totalAvaliacoes: avaliacoes.length,
  };
}

export type SeloChave = "poucosDados" | "otimo" | "bom" | "regular" | "ruim";

// Selo público de um órgão: `chave` indexa o rótulo traduzido (namespace Selo) e
// `className` dá as cores (mesmos tokens das etiquetas de estado). `totalConsiderado` é a base do
// índice (respondidas + sem resposta vencidas): com menos de MINIMO_PARA_CLASSIFICAR o órgão
// ainda não tem selo.
export function classificarIndice(
  indice: number | null,
  totalConsiderado: number
): { chave: SeloChave; className: string } {
  if (indice === null || totalConsiderado < MINIMO_PARA_CLASSIFICAR) {
    return {
      chave: "poucosDados",
      className: "bg-sunken text-ink-muted",
    };
  }
  if (indice >= 80) {
    return {
      chave: "otimo",
      className: "bg-ok-soft text-ok-ink",
    };
  }
  if (indice >= 60) {
    return {
      chave: "bom",
      className: "bg-brand-soft text-brand",
    };
  }
  if (indice >= 40) {
    return {
      chave: "regular",
      className: "bg-warn-soft text-warn-ink",
    };
  }
  return {
    chave: "ruim",
    className: "bg-danger-soft text-danger-ink",
  };
}
