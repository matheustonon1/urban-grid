import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    respostaOficial: { groupBy: vi.fn() },
    orgao: { findUnique: vi.fn() },
    reclamacao: { count: vi.fn(), findMany: vi.fn() },
    avaliacao: { findMany: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { calcularIndiceResolucao, calcularMetricasOrgao, classificarIndice } = await import(
  "./reputacaoOrgao"
);

describe("classificarIndice", () => {
  it("marca como 'poucosDados' quando não há índice", () => {
    expect(classificarIndice(null, 0)).toEqual(
      expect.objectContaining({ chave: "poucosDados" })
    );
  });

  it("marca como 'poucosDados' com amostra pequena, mesmo com índice alto", () => {
    expect(classificarIndice(100, 1)).toEqual(
      expect.objectContaining({ chave: "poucosDados" })
    );
  });

  it("classifica 80% ou mais como otimo", () => {
    expect(classificarIndice(80, 10)).toEqual(expect.objectContaining({ chave: "otimo" }));
    expect(classificarIndice(100, 10)).toEqual(expect.objectContaining({ chave: "otimo" }));
  });

  it("classifica entre 60% e 79% como bom", () => {
    expect(classificarIndice(60, 10)).toEqual(expect.objectContaining({ chave: "bom" }));
    expect(classificarIndice(79, 10)).toEqual(expect.objectContaining({ chave: "bom" }));
  });

  it("classifica entre 40% e 59% como regular", () => {
    expect(classificarIndice(40, 10)).toEqual(expect.objectContaining({ chave: "regular" }));
    expect(classificarIndice(59, 10)).toEqual(expect.objectContaining({ chave: "regular" }));
  });

  it("classifica abaixo de 40% como ruim", () => {
    expect(classificarIndice(0, 10)).toEqual(expect.objectContaining({ chave: "ruim" }));
    expect(classificarIndice(39, 10)).toEqual(expect.objectContaining({ chave: "ruim" }));
  });
});

describe("calcularIndiceResolucao", () => {
  it("sem nada respondido nem vencido não há índice", () => {
    expect(
      calcularIndiceResolucao({ resolvidas: 0, totalRespondidas: 0, semRespostaVencidas: 0 })
    ).toEqual({ base: 0, indice: null });
  });

  it("sem nada sem resposta, é a resolução de sempre (resolvidas / respondidas)", () => {
    expect(
      calcularIndiceResolucao({ resolvidas: 3, totalRespondidas: 4, semRespostaVencidas: 0 })
    ).toEqual({ base: 4, indice: 75 });
  });

  it("a reclamação sem resposta vencida entra na base como não resolvida", () => {
    // Antes: 3/4 = 75%. Ignorar 4 reclamações agora custa: 3/8 = 38%.
    expect(
      calcularIndiceResolucao({ resolvidas: 3, totalRespondidas: 4, semRespostaVencidas: 4 })
    ).toEqual({ base: 8, indice: 38 });
  });

  it("órgão que nunca respondeu e deixou reclamações vencidas tem índice 0, não 'sem dados'", () => {
    expect(
      calcularIndiceResolucao({ resolvidas: 0, totalRespondidas: 0, semRespostaVencidas: 5 })
    ).toEqual({ base: 5, indice: 0 });
    // E com base suficiente isso vira selo "ruim" (e não "poucos dados").
    expect(classificarIndice(0, 5)).toEqual(expect.objectContaining({ chave: "ruim" }));
  });
});

describe("calcularMetricasOrgao - reclamações sem resposta", () => {
  const criadoEm = new Date("2026-06-01T00:00:00Z");
  const orgao = {
    id: "orgao-1",
    cidadeId: "cidade-1",
    ativo: true,
    createdAt: criadoEm,
    categorias: [{ id: "cat-1" }],
  };

  beforeEach(() => {
    vi.mocked(prisma.respostaOficial.groupBy).mockReset();
    vi.mocked(prisma.orgao.findUnique).mockReset();
    vi.mocked(prisma.reclamacao.count).mockReset();
    vi.mocked(prisma.reclamacao.findMany).mockReset();
    vi.mocked(prisma.avaliacao.findMany).mockReset();
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([] as never);
  });

  it("conta a fila do escopo do órgão: sem resposta alguma, aberta, depois de ele existir e além do prazo", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findUnique).mockResolvedValue(orgao as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(4);

    const antes = Date.now();
    const metricas = await calcularMetricasOrgao("orgao-1");

    const { where } = vi.mocked(prisma.reclamacao.count).mock.calls[0][0]!;
    expect(where).toMatchObject({
      cidadeId: "cidade-1",
      categoriaId: { in: ["cat-1"] },
      autor: { OR: [{ orgaoId: null }, { orgaoId: { not: "orgao-1" } }] },
      status: { in: ["PUBLICADA", "EM_ANDAMENTO"] },
      respostas: { none: {} },
      publicadaEm: { gte: criadoEm, lte: expect.any(Date) },
    });
    const limite = (where as { publicadaEm: { lte: Date } }).publicadaEm.lte;
    const quinzeDias = 15 * 24 * 60 * 60 * 1000;
    expect(Math.abs(antes - limite.getTime() - quinzeDias)).toBeLessThan(5_000);

    expect(metricas).toMatchObject({
      totalRespondidas: 0,
      semRespostaVencidas: 4,
      baseDoIndice: 4,
      indiceResolucao: 0,
    });
  });

  it("órgão sem categoria atribuída atende qualquer uma (sem filtro de categoria)", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findUnique).mockResolvedValue({ ...orgao, categorias: [] } as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(0);

    await calcularMetricasOrgao("orgao-1");

    expect(vi.mocked(prisma.reclamacao.count).mock.calls[0][0]!.where).not.toHaveProperty(
      "categoriaId"
    );
  });

  it("órgão desativado não acumula reclamação sem resposta (não pode responder)", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findUnique).mockResolvedValue({ ...orgao, ativo: false } as never);

    const metricas = await calcularMetricasOrgao("orgao-1");

    expect(prisma.reclamacao.count).not.toHaveBeenCalled();
    expect(metricas).toMatchObject({ semRespostaVencidas: 0, baseDoIndice: 0, indiceResolucao: null });
  });

  it("junta o que respondeu com o que deixou vencer: 2 resolvidas de 4 respondidas + 4 vencidas = 25%", async () => {
    const publicada = new Date("2026-07-01T00:00:00Z");
    const resposta = new Date("2026-07-03T00:00:00Z");
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue(
      ["r1", "r2", "r3", "r4"].map((reclamacaoId) => ({
        reclamacaoId,
        _min: { createdAt: resposta },
      })) as never
    );
    vi.mocked(prisma.orgao.findUnique).mockResolvedValue(orgao as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(4);
    vi.mocked(prisma.reclamacao.findMany).mockResolvedValue([
      { id: "r1", publicadaEm: publicada, status: "RESOLVIDA" },
      { id: "r2", publicadaEm: publicada, status: "RESOLVIDA" },
      { id: "r3", publicadaEm: publicada, status: "EM_ANDAMENTO" },
      { id: "r4", publicadaEm: publicada, status: "EM_ANDAMENTO" },
    ] as never);

    const metricas = await calcularMetricasOrgao("orgao-1");

    expect(metricas).toMatchObject({
      totalRespondidas: 4,
      resolvidas: 2,
      semRespostaVencidas: 4,
      baseDoIndice: 8,
      indiceResolucao: 25,
      tempoMedioRespostaDias: 2,
    });
  });

  it("órgão que não existe mais não quebra: sem fila, sem base", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findUnique).mockResolvedValue(null);

    expect(await calcularMetricasOrgao("fantasma")).toMatchObject({
      semRespostaVencidas: 0,
      baseDoIndice: 0,
      indiceResolucao: null,
    });
  });
});
