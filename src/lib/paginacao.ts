export const ITENS_POR_PAGINA = 20;

// Sem limite superior, "?page=999999999999" virava um OFFSET gigante
// passado direto pro banco em toda listagem paginada (pública ou admin) -
// o Prisma ainda tem que avaliar o OFFSET antes de descobrir que não há
// resultado nenhum. Não precisa ser o total de páginas de verdade (isso
// só é conhecido depois de uma consulta de count, que roda em paralelo
// com a listagem na maioria das páginas) - só um teto bem acima de
// qualquer paginação real deste app, pra cortar valores absurdos.
const PAGINA_MAXIMA = 100_000;

export function lerPaginaAtual(valor: string | string[] | undefined): number {
  const numero = typeof valor === "string" ? Number.parseInt(valor, 10) : NaN;
  if (!Number.isFinite(numero) || numero < 1) {
    return 1;
  }
  return Math.min(numero, PAGINA_MAXIMA);
}

export function calcularTotalPaginas(totalItens: number, itensPorPagina = ITENS_POR_PAGINA): number {
  return Math.max(1, Math.ceil(totalItens / itensPorPagina));
}

export function calcularSkip(paginaAtual: number, itensPorPagina = ITENS_POR_PAGINA): number {
  return (paginaAtual - 1) * itensPorPagina;
}
