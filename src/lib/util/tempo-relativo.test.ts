import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatarTempoRelativo } from "./tempo-relativo";

describe("formatarTempoRelativo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formata minutos atrás", () => {
    expect(formatarTempoRelativo(new Date("2026-09-14T11:55:00Z"))).toBe("há 5 minutos");
  });

  it("formata horas atrás", () => {
    expect(formatarTempoRelativo(new Date("2026-09-14T09:00:00Z"))).toBe("há 3 horas");
  });

  it("formata dias atrás", () => {
    expect(formatarTempoRelativo(new Date("2026-09-11T12:00:00Z"))).toBe("há 3 dias");
  });

  it("formata datas futuras", () => {
    expect(formatarTempoRelativo(new Date("2026-09-14T13:00:00Z"))).toBe("em 1 hora");
  });

  it("cai no singular/plural certo do Intl (1 dia, não 1 dias)", () => {
    expect(formatarTempoRelativo(new Date("2026-09-13T12:00:00Z"))).toBe("ontem");
  });

  it("usa minuto como unidade mínima pra intervalos bem curtos", () => {
    expect(formatarTempoRelativo(new Date("2026-09-14T11:59:50Z"))).toBe("este minuto");
  });
});
