import { prisma } from "@/lib/prisma";
import {
  inicioDoDia,
  type DenunciaEstatistica,
  type LogEstatistica,
  type Periodo,
} from "@/lib/moderacao/estatisticas";

const MS_DIA = 86_400_000;

// Teto de linhas lidas: a página calcula tudo em memória (percentis, histograma,
// séries), o que é ótimo até dezenas de milhares de análises e um problema
// depois disso. Passou do teto, a tela avisa que está olhando as mais recentes
// em vez de carregar o banco inteiro.
export const LIMITE_LINHAS_ESTATISTICAS = 20_000;
const LIMITE_LINHAS = LIMITE_LINHAS_ESTATISTICAS;
const LIMITE_FILA = 5_000;

export interface DadosEstatisticas {
  periodo: Periodo;
  agora: Date;
  // Começo do período (00:00 UTC do primeiro dia); null em "todos".
  inicio: Date | null;
  logs: LogEstatistica[];
  // Período imediatamente anterior, de mesmo tamanho, pra mostrar variação.
  // null quando não dá pra comparar ("todos", ou os dados foram truncados).
  logsAnteriores: LogEstatistica[] | null;
  truncado: boolean;
  denuncias: DenunciaEstatistica[];
  // Desde quando cada item espera, por fila (o retrato é de agora, não do período).
  filas: { reclamacoes: Date[]; comentarios: Date[]; denuncias: Date[] };
}

export async function carregarEstatisticasModeracao(
  periodo: Periodo,
  agora: Date = new Date()
): Promise<DadosEstatisticas> {
  const inicio = periodo.dias
    ? new Date(inicioDoDia(agora).getTime() - (periodo.dias - 1) * MS_DIA)
    : null;
  const inicioAnterior =
    inicio && periodo.dias ? new Date(inicio.getTime() - periodo.dias * MS_DIA) : null;

  const [linhas, denuncias, filaReclamacoes, filaComentarios, filaDenuncias] = await Promise.all([
    prisma.logModeracao.findMany({
      where: {
        alvoTipo: { in: ["RECLAMACAO", "COMENTARIO"] },
        ...((inicioAnterior ?? inicio) ? { createdAt: { gte: inicioAnterior ?? inicio! } } : {}),
      },
      select: {
        alvoTipo: true,
        decisao: true,
        scoreGeral: true,
        scoreOfensivo: true,
        scoreSpam: true,
        scoreDadosPessoais: true,
        scoreForaEscopo: true,
        scoreDesinformacao: true,
        coerenciaTextoImagem: true,
        versaoPrompt: true,
        latenciaMs: true,
        tokensEntrada: true,
        tokensSaida: true,
        decisaoFinal: true,
        revisadoEm: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: LIMITE_LINHAS + 1,
    }),
    prisma.denuncia.findMany({
      where: inicio ? { createdAt: { gte: inicio } } : {},
      select: { motivo: true, status: true, createdAt: true, analisadoEm: true },
      orderBy: { createdAt: "desc" },
      take: LIMITE_LINHAS,
    }),
    // Mesmos critérios das filas de verdade (ver lib/moderacao/pendencias.ts).
    prisma.reclamacao.findMany({
      where: { status: "AGUARDANDO_REVISAO" },
      select: { updatedAt: true },
      take: LIMITE_FILA,
    }),
    prisma.logModeracao.findMany({
      where: { alvoTipo: "COMENTARIO", decisao: "REPROVAR", revisadoEm: null },
      select: { createdAt: true },
      take: LIMITE_FILA,
    }),
    prisma.denuncia.findMany({
      where: { status: "ABERTA" },
      select: { createdAt: true },
      take: LIMITE_FILA,
    }),
  ]);

  const truncado = linhas.length > LIMITE_LINHAS;
  // O where já exclui alvoTipo MIDIA; o tipo do Prisma é que não sabe disso.
  const todas = linhas.slice(0, LIMITE_LINHAS) as LogEstatistica[];

  // Com dados truncados, a comparação com o período anterior seria feita
  // sobre metade de um e o todo do outro: melhor não mostrar.
  const separar = inicio !== null && !truncado;
  const logs = separar ? todas.filter((log) => log.createdAt >= inicio) : todas;
  const logsAnteriores = separar ? todas.filter((log) => log.createdAt < inicio) : null;

  return {
    periodo,
    agora,
    inicio,
    logs,
    logsAnteriores,
    truncado,
    denuncias,
    filas: {
      reclamacoes: filaReclamacoes.map((r) => r.updatedAt),
      comentarios: filaComentarios.map((l) => l.createdAt),
      denuncias: filaDenuncias.map((d) => d.createdAt),
    },
  };
}
