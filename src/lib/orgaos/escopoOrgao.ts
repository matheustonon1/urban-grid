import type { Prisma } from "@prisma/client";

// O que ainda está aberto para o órgão: publicada ou em andamento (resolvida e arquivada saem
// da fila dele).
const STATUS_ABERTOS = ["PUBLICADA", "EM_ANDAMENTO"] as const;

// Regra única de "esta reclamação é do órgão?", usada pela fila do painel, pelo aviso em
// tempo real e pelo resumo semanal: se cada um montasse o próprio filtro, o número que o
// e-mail promete deixaria de bater com o que o painel mostra.
//
// - da cidade do órgão;
// - de uma categoria que ele atende (`categoriaIds` nulo = atende qualquer uma, ver
//   orgaoAtendeCategoria);
// - que não foi aberta por uma conta do próprio órgão: ele não responde ao que ele mesmo abriu
//   (responderReclamacao recusa), então listar seria oferecer um "Responder" que só leva a um
//   erro. O `orgaoId: null` explícito é essencial: o autor comum não tem órgão, e `NOT`/`not`
//   sozinhos viram SQL com NULL (`NOT (orgaoId = ?)` é NULL, não verdadeiro) e esvaziariam a
//   fila inteira.
export function escopoDeReclamacoesDoOrgao(
  orgao: { id: string; cidadeId: string },
  categoriaIds: string[] | null
): Prisma.ReclamacaoWhereInput {
  return {
    cidadeId: orgao.cidadeId,
    ...(categoriaIds ? { categoriaId: { in: categoriaIds } } : {}),
    autor: { OR: [{ orgaoId: null }, { orgaoId: { not: orgao.id } }] },
  };
}

export const filtroAbertas: Prisma.ReclamacaoWhereInput = {
  status: { in: [...STATUS_ABERTOS] },
};

// "Sem resposta": aberta e sem nenhuma resposta oficial de qualquer órgão.
export function filtroSemRespostaDoOrgao(
  orgao: { id: string; cidadeId: string },
  categoriaIds: string[] | null
): Prisma.ReclamacaoWhereInput {
  return {
    ...escopoDeReclamacoesDoOrgao(orgao, categoriaIds),
    ...filtroAbertas,
    respostas: { none: {} },
  };
}
