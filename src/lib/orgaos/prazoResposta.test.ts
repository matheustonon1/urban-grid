import { describe, expect, it } from "vitest";

import { limiteDoPrazoSemResposta, PRAZO_SEM_RESPOSTA_DIAS } from "./prazoResposta";

describe("prazo sem resposta", () => {
  it("é de 15 dias", () => {
    expect(PRAZO_SEM_RESPOSTA_DIAS).toBe(15);
  });

  it("o limite é exatamente 15 dias antes de agora", () => {
    const agora = new Date("2026-11-20T12:00:00Z");
    expect(limiteDoPrazoSemResposta(agora)).toEqual(new Date("2026-11-05T12:00:00Z"));
  });
});
