import { describe, expect, it } from "vitest";

import {
  formatarBucket,
  formatarDuracao,
  formatarLatencia,
  formatarPorcentagem,
  formatarVariacao,
} from "./formatarEstatistica";

describe("formatarDuracao", () => {
  it("escolhe a unidade pela ordem de grandeza", () => {
    expect(formatarDuracao(30_000, "pt-BR")).toBe("< 1 min");
    expect(formatarDuracao(12 * 60_000, "pt-BR")).toBe("12 min");
    expect(formatarDuracao(2.5 * 3_600_000, "pt-BR")).toBe("2,5 h");
    expect(formatarDuracao(2.5 * 3_600_000, "en")).toBe("2.5 h");
    expect(formatarDuracao(20 * 3_600_000, "pt-BR")).toBe("20 h");
    expect(formatarDuracao(72 * 3_600_000, "pt-BR")).toBe("3 d");
  });
  it("nulo vira travessão", () => {
    expect(formatarDuracao(null, "pt-BR")).toBe("—");
  });
});

describe("formatarLatencia", () => {
  it("milissegundos em segundos com uma casa", () => {
    expect(formatarLatencia(1234, "pt-BR")).toBe("1,2 s");
    expect(formatarLatencia(null, "pt-BR")).toBe("—");
  });
});

describe("formatarPorcentagem", () => {
  it("fração em porcentagem inteira", () => {
    expect(formatarPorcentagem(0.456, "pt-BR").replace(/\s/g, "")).toBe("46%");
    expect(formatarPorcentagem(null, "pt-BR")).toBe("—");
  });
});

describe("formatarVariacao", () => {
  it("sinal explícito e unidade", () => {
    expect(formatarVariacao(12.4, "pt-BR", "%")).toBe("+12%");
    expect(formatarVariacao(-3.46, "pt-BR", "pp")).toBe("−3,5 pp");
    expect(formatarVariacao(0, "pt-BR", "pp")).toBe("0 pp");
  });
});

describe("formatarBucket", () => {
  it("dia/mês em UTC, e mês/ano pra granularidade mensal", () => {
    const data = new Date("2026-10-05T00:00:00Z");
    expect(formatarBucket(data, "dia", "pt-BR")).toBe("05/10");
    expect(formatarBucket(data, "mes", "pt-BR")).toMatch(/out/i);
  });
});
