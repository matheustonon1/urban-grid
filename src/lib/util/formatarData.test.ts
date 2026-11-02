import { describe, expect, it } from "vitest";

import {
  diaCalendarioVencido,
  formatarData,
  formatarDataHora,
  formatarDataNumerica,
  formatarDiaCalendario,
  formatarHora,
} from "./formatarData";

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

// 01:30 UTC de 2 de novembro é 22:30 de 1º de novembro em Brasília. Num servidor em UTC (a Vercel),
// sem fuso fixo, a tela mostrava o dia e a hora do servidor: 2 de nov., 01:30.
const MADRUGADA_UTC = new Date("2026-11-02T01:30:00Z");

describe("fuso fixo de Brasília", () => {
  it("mostra a hora e o dia de Brasília, não os do servidor", () => {
    expect(formatarHora(MADRUGADA_UTC, "pt-BR")).toBe("22:30");
    expect(formatarData(MADRUGADA_UTC, "pt-BR")).toMatch(/^1 de nov\. de 2026/);
    expect(formatarDataHora(MADRUGADA_UTC, "pt-BR")).toMatch(/^1 de nov\. de 2026.*22:30$/);
    expect(formatarDataNumerica(MADRUGADA_UTC, "pt-BR")).toBe("01/11/2026");
  });

  it("vale também em inglês", () => {
    expect(formatarData(MADRUGADA_UTC, "en")).toMatch(/Nov 1, 2026/);
  });
});

describe("dia de calendário (prazo estimado)", () => {
  // O que o <input type="date"> grava para "15/01/2030".
  const PRAZO = new Date("2030-01-15");

  it("mostra o dia que a pessoa escolheu, não a noite do dia anterior", () => {
    expect(formatarDiaCalendario(PRAZO, "pt-BR")).toMatch(/^15 de jan\. de 2030/);
    // Formatado como instante em Brasília seria 14 (21:00): o erro que isto evita.
    expect(formatarData(PRAZO, "pt-BR")).toMatch(/^14 de jan\. de 2030/);
  });

  it("só vence no fim do dia, em Brasília, e não no começo dele", () => {
    // Fim do dia 15 em Brasília = 03:00 UTC do dia 16.
    expect(diaCalendarioVencido(PRAZO, new Date("2030-01-14T12:00:00Z"))).toBe(false);
    expect(diaCalendarioVencido(PRAZO, new Date("2030-01-15T00:00:00Z"))).toBe(false);
    expect(diaCalendarioVencido(PRAZO, new Date("2030-01-15T23:59:00Z"))).toBe(false);
    expect(diaCalendarioVencido(PRAZO, new Date("2030-01-16T02:59:59Z"))).toBe(false);
    expect(diaCalendarioVencido(PRAZO, new Date("2030-01-16T03:00:00Z"))).toBe(true);
    expect(diaCalendarioVencido(PRAZO, new Date("2030-02-01T00:00:00Z"))).toBe(true);
  });
});
