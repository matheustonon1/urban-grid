import { describe, expect, it } from "vitest";

import { sanitizarNomeArquivo } from "./storage";

describe("sanitizarNomeArquivo", () => {
  it("mantém um nome já seguro como está", () => {
    expect(sanitizarNomeArquivo("foto-da-rua_2.png")).toBe("foto-da-rua_2.png");
  });

  // Bug corrigido: nomeArquivo vem de arquivo.name (controlado por quem
  // faz upload) e ia direto pra chave do Blob público, sem sanitização.
  it("remove barras (evita fugir do prefixo reclamacoes/{id}/ esperado)", () => {
    const sanitizado = sanitizarNomeArquivo("../outra-reclamacao/foto.png");
    expect(sanitizado).not.toContain("/");
    expect(sanitizado).not.toContain("..");
  });

  it("remove barras invertidas também", () => {
    expect(sanitizarNomeArquivo("..\\..\\etc\\arquivo.png")).not.toContain("\\");
  });

  it("troca caracteres fora de a-z/A-Z/0-9/./_/- por underscore", () => {
    const sanitizado = sanitizarNomeArquivo("foto com espaço #1?.png");
    expect(sanitizado).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(sanitizado.endsWith(".png")).toBe(true);
  });

  it("nunca devolve string vazia", () => {
    expect(sanitizarNomeArquivo("")).toBe("arquivo");
    expect(sanitizarNomeArquivo("///")).toBe("arquivo");
  });

  it("limita o tamanho do nome", () => {
    const nomeGigante = "a".repeat(500) + ".png";
    expect(sanitizarNomeArquivo(nomeGigante).length).toBeLessThanOrEqual(200);
  });
});
