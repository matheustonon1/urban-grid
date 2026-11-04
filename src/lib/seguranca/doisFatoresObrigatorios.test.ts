import { describe, expect, it } from "vitest";

import { doisFatoresObrigatorio, faltaAtivarDoisFatores } from "./doisFatoresObrigatorios";

describe("doisFatoresObrigatorio", () => {
  it("exige do órgão, que responde em nome de uma prefeitura", () => {
    expect(doisFatoresObrigatorio("ORGAO")).toBe(true);
  });

  it("não exige dos demais papéis nem de sessão sem papel", () => {
    expect(doisFatoresObrigatorio("CIDADAO")).toBe(false);
    expect(doisFatoresObrigatorio("MODERADOR")).toBe(false);
    expect(doisFatoresObrigatorio("ADMIN")).toBe(false);
    expect(doisFatoresObrigatorio(undefined)).toBe(false);
  });
});

describe("faltaAtivarDoisFatores", () => {
  it("falta quando o órgão não tem o 2FA ativo", () => {
    expect(faltaAtivarDoisFatores({ papel: "ORGAO", doisFatores: false })).toBe(true);
  });

  it("trata a ausência do dado na sessão como 2FA inativo (falha fechada)", () => {
    expect(faltaAtivarDoisFatores({ papel: "ORGAO" })).toBe(true);
  });

  it("não falta quando o órgão já ativou", () => {
    expect(faltaAtivarDoisFatores({ papel: "ORGAO", doisFatores: true })).toBe(false);
  });

  it("nunca falta para um papel que não é obrigado, com ou sem 2FA", () => {
    expect(faltaAtivarDoisFatores({ papel: "CIDADAO", doisFatores: false })).toBe(false);
    expect(faltaAtivarDoisFatores({ papel: "ADMIN" })).toBe(false);
  });
});
