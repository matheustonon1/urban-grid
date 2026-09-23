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
// responder - ver orgaoAtendeCategoria em lib/orgaoCategoria.ts).
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

// Rótulo em português usado pelas páginas que ainda não têm tradução
// (painel do órgão, detalhe de órgão, detalhe de cidade) - a home usa
// suas próprias chaves de tradução (namespace Home) em vez deste mapa.
export const SELO_LABEL_PT: Record<SeloChave, string> = {
  poucosDados: "Poucos dados ainda",
  otimo: "Ótimo",
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
};

export function classificarIndice(
  indice: number | null,
  totalRespondidas: number
): { chave: SeloChave; className: string } {
  if (indice === null || totalRespondidas < MINIMO_PARA_CLASSIFICAR) {
    return {
      chave: "poucosDados",
      className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    };
  }
  if (indice >= 80) {
    return {
      chave: "otimo",
      className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
    };
  }
  if (indice >= 60) {
    return {
      chave: "bom",
      className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    };
  }
  if (indice >= 40) {
    return {
      chave: "regular",
      className: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
    };
  }
  return {
    chave: "ruim",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  };
}
