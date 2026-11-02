import { describe, expect, it } from "vitest";

import { podeAvaliar } from "./avaliacao";

const antes = new Date("2026-10-01T10:00:00Z");
const depois = new Date("2026-10-05T10:00:00Z");

describe("podeAvaliar", () => {
  it("só avalia uma reclamação resolvida", () => {
    for (const status of ["PUBLICADA", "EM_ANDAMENTO", "REJEITADA", "ARQUIVADA"] as const) {
      expect(podeAvaliar({ status, resolvidaEm: null }, null), status).toBe(false);
    }
    expect(podeAvaliar({ status: "RESOLVIDA", resolvidaEm: antes }, null)).toBe(true);
  });

  it("uma confirmação é definitiva", () => {
    const confirmada = { resolvido: true, createdAt: antes };
    expect(podeAvaliar({ status: "RESOLVIDA", resolvidaEm: depois }, confirmada)).toBe(false);
  });

  it("uma contestação ainda não respondida pelo órgão não abre outra avaliação", () => {
    const contestada = { resolvido: false, createdAt: depois };
    expect(podeAvaliar({ status: "RESOLVIDA", resolvidaEm: antes }, contestada)).toBe(false);
  });

  it("depois que o órgão resolve de novo, o autor avalia outra vez", () => {
    const contestada = { resolvido: false, createdAt: antes };
    expect(podeAvaliar({ status: "RESOLVIDA", resolvidaEm: depois }, contestada)).toBe(true);
  });

  it("reclamação reaberta (em andamento) não se avalia, mesmo com contestação anterior", () => {
    const contestada = { resolvido: false, createdAt: antes };
    expect(podeAvaliar({ status: "EM_ANDAMENTO", resolvidaEm: null }, contestada)).toBe(false);
  });
});
