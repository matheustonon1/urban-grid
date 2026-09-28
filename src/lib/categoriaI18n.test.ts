import { describe, expect, it } from "vitest";

import { nomeCategoriaTraduzido } from "./categoriaI18n";

describe("nomeCategoriaTraduzido", () => {
  it("mantém o nome original em português", () => {
    expect(nomeCategoriaTraduzido("coleta-de-lixo", "Coleta de lixo", "pt-BR")).toBe(
      "Coleta de lixo"
    );
  });

  it("traduz pro inglês quando o slug está cadastrado", () => {
    expect(nomeCategoriaTraduzido("coleta-de-lixo", "Coleta de lixo", "en")).toBe(
      "Garbage collection"
    );
  });

  it("volta pro nome original em inglês se o slug não tiver tradução cadastrada", () => {
    expect(nomeCategoriaTraduzido("categoria-nova-sem-traducao", "Categoria Nova", "en")).toBe(
      "Categoria Nova"
    );
  });
});
