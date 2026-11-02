import { describe, expect, it } from "vitest";

import { JANELA_CORRECAO_MS, limiteDaCorrecao, motivoSemCorrecao } from "./correcaoResposta";

const criadaEm = new Date("2026-11-02T14:00:00Z");
const minutosDepois = (min: number) => new Date(criadaEm.getTime() + min * 60_000);

const base = {
  resposta: { orgaoId: "org-1", createdAt: criadaEm },
  orgaoIdDoUsuario: "org-1",
  agora: minutosDepois(2),
  haRespostaPosterior: false,
  avaliadaDepois: false,
};

describe("motivoSemCorrecao", () => {
  it("o órgão que respondeu corrige a resposta recém-enviada", () => {
    expect(motivoSemCorrecao(base)).toBeNull();
  });

  it("vale até o fim da janela, inclusive, e deixa de valer um instante depois", () => {
    expect(motivoSemCorrecao({ ...base, agora: new Date(criadaEm.getTime() + JANELA_CORRECAO_MS) })).toBeNull();
    expect(
      motivoSemCorrecao({ ...base, agora: new Date(criadaEm.getTime() + JANELA_CORRECAO_MS + 1) })
    ).toBe("janela");
  });

  it("outro órgão, ou quem não é de órgão nenhum, não corrige", () => {
    expect(motivoSemCorrecao({ ...base, orgaoIdDoUsuario: "org-2" })).toBe("outroOrgao");
    expect(motivoSemCorrecao({ ...base, orgaoIdDoUsuario: null })).toBe("outroOrgao");
    expect(motivoSemCorrecao({ ...base, orgaoIdDoUsuario: undefined })).toBe("outroOrgao");
  });

  it("não corrige uma resposta que já tem outra depois dela", () => {
    expect(motivoSemCorrecao({ ...base, haRespostaPosterior: true })).toBe("outraResposta");
  });

  it("não corrige depois que o autor avaliou a resolução que ela anunciou", () => {
    expect(motivoSemCorrecao({ ...base, avaliadaDepois: true })).toBe("avaliada");
  });

  it("a ordem dos motivos: de quem é, depois o tempo, depois o que veio depois", () => {
    const tudoErrado = {
      ...base,
      orgaoIdDoUsuario: "org-2",
      agora: minutosDepois(60),
      haRespostaPosterior: true,
      avaliadaDepois: true,
    };
    expect(motivoSemCorrecao(tudoErrado)).toBe("outroOrgao");
    expect(motivoSemCorrecao({ ...tudoErrado, orgaoIdDoUsuario: "org-1" })).toBe("janela");
    expect(motivoSemCorrecao({ ...tudoErrado, orgaoIdDoUsuario: "org-1", agora: minutosDepois(1) })).toBe(
      "outraResposta"
    );
  });
});

describe("limiteDaCorrecao", () => {
  it("é o envio mais a janela", () => {
    expect(limiteDaCorrecao(criadaEm).getTime()).toBe(criadaEm.getTime() + JANELA_CORRECAO_MS);
  });
});
