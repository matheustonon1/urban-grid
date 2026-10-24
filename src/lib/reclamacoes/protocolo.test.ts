import { describe, expect, it } from "vitest";

import { prefixoProtocolo, proximoProtocolo } from "./protocolo";

describe("prefixoProtocolo", () => {
  it("monta o prefixo com o ano", () => {
    expect(prefixoProtocolo(2026)).toBe("UG-2026-");
  });
});

describe("proximoProtocolo", () => {
  it("começa em 1 quando não há protocolo anterior", () => {
    expect(proximoProtocolo("UG-2026-", null)).toBe("UG-2026-0000001");
  });

  it("incrementa a partir do maior número existente", () => {
    expect(proximoProtocolo("UG-2026-", "UG-2026-0000042")).toBe("UG-2026-0000043");
  });

  it("preenche com zeros à esquerda até 7 dígitos", () => {
    expect(proximoProtocolo("UG-2026-", "UG-2026-0000009")).toBe("UG-2026-0000010");
  });

  it("não gera protocolo duplicado por causa de um buraco na sequência (ex.: linha apagada)", () => {
    // Mesmo que só exista 1 reclamação no banco, se o maior protocolo já
    // gerado foi 0000050 (as anteriores foram apagadas), o próximo tem
    // que ser 51 - contar linhas geraria 2, que já existiu antes.
    expect(proximoProtocolo("UG-2026-", "UG-2026-0000050")).toBe("UG-2026-0000051");
  });
});
