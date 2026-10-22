import { describe, expect, it } from "vitest";

import { formatarData, formatarDataHora } from "./formatarData";

// Meio-dia UTC: cai no mesmo dia em qualquer fuso do Brasil e da Europa,
// então o teste não depende do fuso da máquina que roda.
const DATA = new Date("2026-10-21T15:12:41Z");

describe("formatarData", () => {
  it("formata por extenso e sem segundos, no idioma pedido", () => {
    const pt = formatarData(DATA, "pt-BR");
    expect(pt).toMatch(/21/);
    expect(pt).toMatch(/2026/);
    expect(pt).toMatch(/out/i);
    expect(formatarData(DATA, "en")).toMatch(/Oct/);
  });

  it("não despeja o formato numérico cru com vírgula e segundos", () => {
    expect(formatarData(DATA, "pt-BR")).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatarDataHora(DATA, "pt-BR")).not.toMatch(/:\d{2}:\d{2}/);
  });

  it("a versão com hora traz hora e minuto", () => {
    expect(formatarDataHora(DATA, "pt-BR")).toMatch(/\d{1,2}:\d{2}/);
  });
});
