import { describe, expect, it } from "vitest";

import { escopoDeReclamacoesDoOrgao, filtroSemRespostaDoOrgao } from "./escopoOrgao";

const orgao = { id: "orgao-1", cidadeId: "cidade-1" };

describe("escopoDeReclamacoesDoOrgao", () => {
  it("limita à cidade do órgão e exclui o que a própria conta do órgão abriu", () => {
    expect(escopoDeReclamacoesDoOrgao(orgao, null)).toEqual({
      cidadeId: "cidade-1",
      // `orgaoId: null` explícito: o autor comum não tem órgão, e só `not` esvaziaria a fila.
      autor: { OR: [{ orgaoId: null }, { orgaoId: { not: "orgao-1" } }] },
    });
  });

  it("sem categoria atribuída atende qualquer uma (nenhum filtro de categoria)", () => {
    expect(escopoDeReclamacoesDoOrgao(orgao, null)).not.toHaveProperty("categoriaId");
  });

  it("com categorias atribuídas, restringe a elas", () => {
    expect(escopoDeReclamacoesDoOrgao(orgao, ["cat-a", "cat-b"])).toMatchObject({
      categoriaId: { in: ["cat-a", "cat-b"] },
    });
  });
});

describe("filtroSemRespostaDoOrgao", () => {
  it("é o escopo + aberta (publicada ou em andamento) + sem nenhuma resposta", () => {
    expect(filtroSemRespostaDoOrgao(orgao, ["cat-a"])).toEqual({
      cidadeId: "cidade-1",
      categoriaId: { in: ["cat-a"] },
      autor: { OR: [{ orgaoId: null }, { orgaoId: { not: "orgao-1" } }] },
      status: { in: ["PUBLICADA", "EM_ANDAMENTO"] },
      respostas: { none: {} },
    });
  });
});
