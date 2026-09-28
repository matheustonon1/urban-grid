import { describe, expect, it } from "vitest";

import { calcularSkip, calcularTotalPaginas, lerPaginaAtual } from "./paginacao";

describe("lerPaginaAtual", () => {
  it("usa 1 quando o valor está ausente, inválido ou é menor que 1", () => {
    expect(lerPaginaAtual(undefined)).toBe(1);
    expect(lerPaginaAtual("abc")).toBe(1);
    expect(lerPaginaAtual("0")).toBe(1);
    expect(lerPaginaAtual("-5")).toBe(1);
  });

  it("aceita um número de página válido", () => {
    expect(lerPaginaAtual("3")).toBe(3);
  });

  // Bug corrigido: sem teto, um valor absurdo virava um OFFSET gigante
  // passado direto pro Prisma em qualquer listagem paginada.
  it("limita a um teto em vez de aceitar qualquer inteiro positivo", () => {
    expect(lerPaginaAtual("999999999999")).toBeLessThanOrEqual(100_000);
    expect(lerPaginaAtual(String(Number.MAX_SAFE_INTEGER))).toBeLessThanOrEqual(100_000);
  });
});

describe("calcularSkip / calcularTotalPaginas", () => {
  it("calculam corretamente com os valores padrão", () => {
    expect(calcularSkip(1)).toBe(0);
    expect(calcularSkip(3)).toBe(40);
    expect(calcularTotalPaginas(45)).toBe(3);
    expect(calcularTotalPaginas(0)).toBe(1);
  });
});
