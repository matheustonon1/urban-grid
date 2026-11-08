import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    respostaOficial: { groupBy: vi.fn() },
    orgao: { findMany: vi.fn() },
    reclamacao: { count: vi.fn(), findMany: vi.fn() },
    avaliacao: { findMany: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const {
  calcularIndiceResolucao,
  calcularMetricasDeOrgaos,
  calcularMetricasOrgao,
  classificarIndice,
  montarMetricasOrgao,
} = await import("./reputacaoOrgao");

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
    vi.mocked(prisma.orgao.findMany).mockReset();
    vi.mocked(prisma.reclamacao.count).mockReset();
    vi.mocked(prisma.reclamacao.findMany).mockReset();
    vi.mocked(prisma.avaliacao.findMany).mockReset();
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([] as never);
  });

  it("conta a fila do escopo do órgão: sem resposta alguma, aberta, depois de ele existir e além do prazo", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([orgao] as never);
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
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([{ ...orgao, categorias: [] }] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(0);

    await calcularMetricasOrgao("orgao-1");

    expect(vi.mocked(prisma.reclamacao.count).mock.calls[0][0]!.where).not.toHaveProperty(
      "categoriaId"
    );
  });

  it("órgão desativado não acumula reclamação sem resposta (não pode responder)", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([{ ...orgao, ativo: false }] as never);

    const metricas = await calcularMetricasOrgao("orgao-1");

    expect(prisma.reclamacao.count).not.toHaveBeenCalled();
    expect(metricas).toMatchObject({ semRespostaVencidas: 0, baseDoIndice: 0, indiceResolucao: null });
  });

  it("junta o que respondeu com o que deixou vencer: 2 resolvidas de 4 respondidas + 4 vencidas = 25%", async () => {
    const publicada = new Date("2026-07-01T00:00:00Z");
    const resposta = new Date("2026-07-03T00:00:00Z");
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue(
      ["r1", "r2", "r3", "r4"].map((reclamacaoId) => ({
        orgaoId: "orgao-1",
        reclamacaoId,
        _min: { createdAt: resposta },
      })) as never
    );
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([orgao] as never);
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
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([] as never);

    expect(await calcularMetricasOrgao("fantasma")).toMatchObject({
      semRespostaVencidas: 0,
      baseDoIndice: 0,
      indiceResolucao: null,
    });
  });
});

describe("montarMetricasOrgao", () => {
  const dia = (n: number) => new Date(Date.UTC(2026, 6, n)); // julho de 2026

  it("sem respostas, só a fila vencida conta (índice 0, não 'sem dados')", () => {
    expect(
      montarMetricasOrgao({ primeirasRespostas: [], reclamacoes: [], notas: [], semRespostaVencidas: 3 })
    ).toEqual({
      totalRespondidas: 0,
      resolvidas: 0,
      semRespostaVencidas: 3,
      baseDoIndice: 3,
      indiceResolucao: 0,
      tempoMedioRespostaDias: null,
      notaMedia: null,
      totalAvaliacoes: 0,
    });
  });

  it("tempo médio e nota média arredondam a uma casa", () => {
    const metricas = montarMetricasOrgao({
      primeirasRespostas: [
        { reclamacaoId: "r1", primeiraEm: dia(3) },
        { reclamacaoId: "r2", primeiraEm: dia(4) },
        { reclamacaoId: "r3", primeiraEm: dia(4) },
      ],
      reclamacoes: [
        { id: "r1", publicadaEm: dia(1), status: "RESOLVIDA" },
        { id: "r2", publicadaEm: dia(1), status: "EM_ANDAMENTO" },
        { id: "r3", publicadaEm: dia(1), status: "EM_ANDAMENTO" },
      ],
      notas: [5, 4, 4],
      semRespostaVencidas: 0,
    });
    expect(metricas.tempoMedioRespostaDias).toBe(2.7); // (2 + 3 + 3) / 3
    expect(metricas.notaMedia).toBe(4.3); // 13 / 3
    expect(metricas.totalAvaliacoes).toBe(3);
    expect(metricas.indiceResolucao).toBe(33);
  });

  it("reclamação sem data de publicação conta como respondida, mas fica fora do tempo médio", () => {
    const metricas = montarMetricasOrgao({
      primeirasRespostas: [
        { reclamacaoId: "r1", primeiraEm: dia(3) },
        { reclamacaoId: "r2", primeiraEm: dia(9) },
      ],
      reclamacoes: [
        { id: "r1", publicadaEm: dia(1), status: "RESOLVIDA" },
        { id: "r2", publicadaEm: null, status: "RESOLVIDA" },
      ],
      notas: [],
      semRespostaVencidas: 0,
    });
    expect(metricas).toMatchObject({ totalRespondidas: 2, resolvidas: 2, tempoMedioRespostaDias: 2 });
  });

  it("resposta anterior à publicação (tempo negativo) não entra no tempo médio", () => {
    const metricas = montarMetricasOrgao({
      primeirasRespostas: [{ reclamacaoId: "r1", primeiraEm: dia(1) }],
      reclamacoes: [{ id: "r1", publicadaEm: dia(5), status: "EM_ANDAMENTO" }],
      notas: [],
      semRespostaVencidas: 0,
    });
    expect(metricas.tempoMedioRespostaDias).toBeNull();
  });
});

describe("calcularMetricasDeOrgaos (em lote)", () => {
  const criadoEm = new Date("2026-06-01T00:00:00Z");
  const orgao = (id: string) => ({
    id,
    cidadeId: "cidade-1",
    ativo: true,
    createdAt: criadoEm,
    categorias: [],
  });

  beforeEach(() => {
    vi.mocked(prisma.respostaOficial.groupBy).mockReset();
    vi.mocked(prisma.orgao.findMany).mockReset();
    vi.mocked(prisma.reclamacao.count).mockReset();
    vi.mocked(prisma.reclamacao.findMany).mockReset();
    vi.mocked(prisma.avaliacao.findMany).mockReset();
  });

  function dadosDeDoisOrgaos() {
    const publicada = new Date("2026-07-01T00:00:00Z");
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([
      { orgaoId: "a", reclamacaoId: "r1", _min: { createdAt: new Date("2026-07-03T00:00:00Z") } },
      { orgaoId: "a", reclamacaoId: "r2", _min: { createdAt: new Date("2026-07-03T00:00:00Z") } },
      // r1 também foi respondida por "b": entra nas contas dos dois, como antes.
      { orgaoId: "b", reclamacaoId: "r1", _min: { createdAt: new Date("2026-07-05T00:00:00Z") } },
    ] as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([orgao("a"), orgao("b")] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    vi.mocked(prisma.reclamacao.findMany).mockResolvedValue([
      { id: "r1", publicadaEm: publicada, status: "RESOLVIDA" },
      { id: "r2", publicadaEm: publicada, status: "EM_ANDAMENTO" },
    ] as never);
    vi.mocked(prisma.avaliacao.findMany).mockResolvedValue([
      { reclamacaoId: "r1", nota: 5 },
      { reclamacaoId: "r2", nota: 3 },
    ] as never);
  }

  it("separa as métricas de cada órgão a partir das mesmas consultas", async () => {
    dadosDeDoisOrgaos();

    const resultado = await calcularMetricasDeOrgaos(["a", "b"]);

    expect(resultado.get("a")).toEqual({
      totalRespondidas: 2,
      resolvidas: 1,
      semRespostaVencidas: 1,
      baseDoIndice: 3,
      indiceResolucao: 33,
      tempoMedioRespostaDias: 2,
      notaMedia: 4,
      totalAvaliacoes: 2,
    });
    expect(resultado.get("b")).toEqual({
      totalRespondidas: 1,
      resolvidas: 1,
      semRespostaVencidas: 0,
      baseDoIndice: 1,
      indiceResolucao: 100,
      tempoMedioRespostaDias: 4,
      notaMedia: 5,
      totalAvaliacoes: 1,
    });
  });

  it("o número de consultas não cresce com o de órgãos: 4 fixas + 1 contagem por órgão", async () => {
    dadosDeDoisOrgaos();

    await calcularMetricasDeOrgaos(["a", "b"]);

    expect(prisma.respostaOficial.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.orgao.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.reclamacao.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.avaliacao.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.reclamacao.count).toHaveBeenCalledTimes(2);
    expect(vi.mocked(prisma.respostaOficial.groupBy).mock.calls[0][0]).toMatchObject({
      by: ["orgaoId", "reclamacaoId"],
      where: { orgaoId: { in: ["a", "b"] } },
    });
  });

  it("id repetido na lista é calculado uma vez só", async () => {
    dadosDeDoisOrgaos();

    const resultado = await calcularMetricasDeOrgaos(["a", "a", "a"]);

    expect(resultado.size).toBe(1);
    expect(prisma.reclamacao.count).toHaveBeenCalledTimes(1);
  });

  it("lista vazia não consulta o banco", async () => {
    const resultado = await calcularMetricasDeOrgaos([]);

    expect(resultado.size).toBe(0);
    expect(prisma.respostaOficial.groupBy).not.toHaveBeenCalled();
    expect(prisma.orgao.findMany).not.toHaveBeenCalled();
  });

  it("ninguém respondeu: não busca reclamações nem avaliações", async () => {
    vi.mocked(prisma.respostaOficial.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([orgao("a")] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(2);

    const resultado = await calcularMetricasDeOrgaos(["a"]);

    expect(prisma.reclamacao.findMany).not.toHaveBeenCalled();
    expect(prisma.avaliacao.findMany).not.toHaveBeenCalled();
    expect(resultado.get("a")).toMatchObject({ totalRespondidas: 0, semRespostaVencidas: 2, indiceResolucao: 0 });
  });
});
