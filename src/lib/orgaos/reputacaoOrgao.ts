import { prisma } from "@/lib/prisma";

const MINIMO_PARA_CLASSIFICAR = 3;

export interface MetricasOrgao {
  totalRespondidas: number;
  resolvidas: number;
  indiceResolucao: number | null;
  tempoMedioRespostaDias: number | null;
  notaMedia: number | null;
  totalAvaliacoes: number;
}

// Reclamacao não tem orgaoId direto - o vínculo é via RespostaOficial
// (qualquer órgão ativo e habilitado pra categoria da reclamação pode
// responder - ver orgaoAtendeCategoria em lib/orgaos/orgaoCategoria.ts).
// "Respondida por este órgão" = tem ao menos uma RespostaOficial dele; o
// índice de resolução e o tempo de resposta são calculados só sobre
// esse conjunto.
export async function calcularMetricasOrgao(orgaoId: string): Promise<MetricasOrgao> {
  const primeirasRespostas = await prisma.respostaOficial.groupBy({
    by: ["reclamacaoId"],
    where: { orgaoId },
    _min: { createdAt: true },
  });

  const reclamacaoIds = primeirasRespostas.map((r) => r.reclamacaoId);
  const totalRespondidas = reclamacaoIds.length;

  if (totalRespondidas === 0) {
    return {
      totalRespondidas: 0,
      resolvidas: 0,
      indiceResolucao: null,
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
  const indiceResolucao = Math.round((resolvidas / totalRespondidas) * 100);

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
    indiceResolucao,
    tempoMedioRespostaDias,
    notaMedia,
    totalAvaliacoes: avaliacoes.length,
  };
}

export type SeloChave = "poucosDados" | "otimo" | "bom" | "regular" | "ruim";

// Selo público de um órgão: `chave` indexa o rótulo traduzido (namespace Selo) e
// `className` dá as cores (mesmos tokens das etiquetas de estado).
export function classificarIndice(
  indice: number | null,
  totalRespondidas: number
): { chave: SeloChave; className: string } {
  if (indice === null || totalRespondidas < MINIMO_PARA_CLASSIFICAR) {
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
