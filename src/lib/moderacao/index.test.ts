import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ehFalhaDaIA, TENTATIVAS_DA_IA } from "./falha";
import { decidir } from "./index";

describe("decidir", () => {
  it("aprova score baixo", () => {
    expect(decidir(0)).toBe("APROVAR");
    expect(decidir(0.39)).toBe("APROVAR");
  });

  it("encaminha para revisão na faixa intermediária", () => {
    expect(decidir(0.4)).toBe("ENCAMINHAR_REVISAO");
    expect(decidir(0.74)).toBe("ENCAMINHAR_REVISAO");
  });

  it("reprova score alto", () => {
    expect(decidir(0.75)).toBe("REPROVAR");
    expect(decidir(1)).toBe("REPROVAR");
  });
});

// Testes de moderarReclamacao() abaixo - mocka o cliente Gemini e o
// prisma, sem chamar nenhum dos dois de verdade.
const generateContentMock = vi.fn();

vi.mock("./gemini", () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
}));

vi.mock("@/lib/notificacoes", () => ({
  criarNotificacao: vi.fn(),
}));
vi.mock("@/lib/notificacoes/orgaos", () => ({
  avisarOrgaosDaPublicacao: vi.fn(),
}));

const reclamacaoFake = {
  id: "reclamacao-1",
  titulo: "Buraco na rua",
  descricao: "Buraco grande e perigoso na Rua das Flores.",
  autorId: "user-1",
  protocolo: "UG-2026-0000001",
  categoria: { nome: "Buracos e pavimentação" },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamacao: {
      findUniqueOrThrow: vi.fn(async () => reclamacaoFake),
      update: vi.fn(),
    },
    logModeracao: { create: vi.fn() },
    midia: { updateMany: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { avisarOrgaosDaPublicacao } = await import("@/lib/notificacoes/orgaos");
const { gerarConteudoComRetry, moderarReclamacao } = await import("./index");

function respostaGemini(json: object) {
  return {
    text: JSON.stringify(json),
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  };
}

const scoresBaixosSemImagem = {
  scoreOfensivo: 0.1,
  scoreSpam: 0.1,
  scoreDadosPessoais: 0.1,
  scoreForaEscopo: 0.1,
  scoreDesinformacao: 0.1,
  justificativa: "Reclamação legítima sobre infraestrutura.",
};

beforeEach(() => {
  generateContentMock.mockReset();
  vi.mocked(prisma.reclamacao.update).mockReset();
  vi.mocked(prisma.logModeracao.create).mockReset();
  vi.mocked(prisma.midia.updateMany).mockReset();
  vi.mocked(avisarOrgaosDaPublicacao).mockReset();
});

describe("moderarReclamacao - avaliação de imagem obrigatória quando há imagem anexada", () => {
  it("com imagem, resposta que omite os campos de imagem cai em revisão humana (não aprova por padrão permissivo)", async () => {
    // Cenário do bug: o modelo preenche só os campos de texto e omite
    // scoreImagemImpropria/coerenciaTextoImagem/regioesSensiveis - antes da
    // correção, isso virava scoreImagemImpropria=0, coerenciaTextoImagem=1,
    // regioesSensiveis=[] (os valores mais permissivos) e a reclamação era
    // publicada com a foto original, sem checar rosto/placa nem conteúdo
    // impróprio.
    generateContentMock.mockResolvedValue(respostaGemini(scoresBaixosSemImagem));

    const resultado = await moderarReclamacao(
      "reclamacao-1",
      [{ buffer: Buffer.from("imagem-fake"), mimeType: "image/jpeg" }],
      {}
    );

    expect(resultado.decisao).toBe("ENCAMINHAR_REVISAO");
    expect(prisma.reclamacao.update).toHaveBeenCalledWith({
      where: { id: "reclamacao-1" },
      data: { status: "AGUARDANDO_REVISAO" },
    });
    // Nunca deve ir pra "PUBLICADA" nesse cenário.
    expect(prisma.reclamacao.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PUBLICADA" }) })
    );
  });

  it("pede os 3 campos de imagem como obrigatórios no schema do Gemini quando há imagem", async () => {
    generateContentMock.mockResolvedValue(
      respostaGemini({
        ...scoresBaixosSemImagem,
        scoreImagemImpropria: 0,
        coerenciaTextoImagem: 1,
        regioesSensiveis: [],
      })
    );

    await moderarReclamacao(
      "reclamacao-1",
      [{ buffer: Buffer.from("imagem-fake"), mimeType: "image/jpeg" }],
      {}
    );

    const [chamada] = generateContentMock.mock.calls[0];
    expect(chamada.config.responseSchema.required).toEqual(
      expect.arrayContaining(["scoreImagemImpropria", "coerenciaTextoImagem", "regioesSensiveis"])
    );
  });

  it("sem imagem anexada, aprova normalmente mesmo sem os campos de imagem na resposta", async () => {
    generateContentMock.mockResolvedValue(respostaGemini(scoresBaixosSemImagem));

    const resultado = await moderarReclamacao("reclamacao-1", [], {});

    expect(resultado.decisao).toBe("APROVAR");
    const [chamada] = generateContentMock.mock.calls[0];
    expect(chamada.config.responseSchema.required).not.toContain("scoreImagemImpropria");
  });

  it("publicar avisa o órgão que atende a reclamação; mandar para revisão não avisa", async () => {
    generateContentMock.mockResolvedValue(respostaGemini(scoresBaixosSemImagem));
    await moderarReclamacao("reclamacao-1", [], {});
    expect(avisarOrgaosDaPublicacao).toHaveBeenCalledWith("reclamacao-1");

    // Com imagem e sem os campos de imagem a decisão é revisão humana: nada publicado.
    vi.mocked(avisarOrgaosDaPublicacao).mockClear();
    generateContentMock.mockResolvedValue(respostaGemini(scoresBaixosSemImagem));
    await moderarReclamacao(
      "reclamacao-1",
      [{ buffer: Buffer.from("imagem-fake"), mimeType: "image/jpeg" }],
      {}
    );
    expect(avisarOrgaosDaPublicacao).not.toHaveBeenCalled();
  });

  it("com imagem e resposta completa (todos os campos), aprova normalmente", async () => {
    generateContentMock.mockResolvedValue(
      respostaGemini({
        ...scoresBaixosSemImagem,
        scoreImagemImpropria: 0.05,
        coerenciaTextoImagem: 0.95,
        regioesSensiveis: [],
      })
    );

    const resultado = await moderarReclamacao(
      "reclamacao-1",
      [{ buffer: Buffer.from("imagem-fake"), mimeType: "image/jpeg" }],
      {}
    );

    expect(resultado.decisao).toBe("APROVAR");
  });
});

// Erro como o ApiError do SDK do Gemini: `status` HTTP e a mensagem é o JSON de erro da API.
function erroDaApi(status: number, situacao: string) {
  return Object.assign(
    new Error(JSON.stringify({ error: { code: status, message: "falha simulada", status: situacao } })),
    { name: "ApiError", status }
  );
}

describe("gerarConteudoComRetry", () => {
  const parametros = { model: "gemini-de-teste", contents: "texto" };
  const semEspera = vi.fn<(ms: number) => Promise<void>>(async () => {});

  beforeEach(() => {
    semEspera.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("repete o 503 (modelo sobrecarregado) e devolve a resposta quando uma tentativa passa", async () => {
    generateContentMock
      .mockRejectedValueOnce(erroDaApi(503, "UNAVAILABLE"))
      .mockRejectedValueOnce(erroDaApi(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(respostaGemini({ ok: true }));

    const resposta = await gerarConteudoComRetry(parametros, { aguardar: semEspera });

    expect(JSON.parse(resposta.text ?? "{}")).toEqual({ ok: true });
    expect(generateContentMock).toHaveBeenCalledTimes(3);
    expect(semEspera).toHaveBeenCalledTimes(2);
    // A espera cresce: a segunda é maior que a primeira, mesmo com a variação aleatória.
    const [primeira, segunda] = semEspera.mock.calls.map(([ms]) => ms);
    expect(segunda).toBeGreaterThan(primeira);
  });

  it(`desiste depois de ${TENTATIVAS_DA_IA} chamadas e lança o último erro`, async () => {
    generateContentMock.mockRejectedValue(erroDaApi(503, "UNAVAILABLE"));

    await expect(gerarConteudoComRetry(parametros, { aguardar: semEspera })).rejects.toMatchObject({
      status: 503,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(TENTATIVAS_DA_IA);
    // Não espera depois da última chamada: só entre as tentativas.
    expect(semEspera).toHaveBeenCalledTimes(TENTATIVAS_DA_IA - 1);
  });

  it("não repete erro permanente (modelo ou chave errados): falha na primeira chamada", async () => {
    generateContentMock.mockRejectedValue(erroDaApi(404, "NOT_FOUND"));

    await expect(gerarConteudoComRetry(parametros, { aguardar: semEspera })).rejects.toMatchObject({
      status: 404,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(semEspera).not.toHaveBeenCalled();
  });

  it("não repete 429 (cota): quem envia a reclamação não espera à toa", async () => {
    generateContentMock.mockRejectedValue(erroDaApi(429, "RESOURCE_EXHAUSTED"));

    await expect(gerarConteudoComRetry(parametros, { aguardar: semEspera })).rejects.toMatchObject({
      status: 429,
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("deixa no console o motivo de cada repetição (o erro original se perdia)", async () => {
    generateContentMock
      .mockRejectedValueOnce(erroDaApi(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(respostaGemini({ ok: true }));

    await gerarConteudoComRetry(parametros, { aguardar: semEspera });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 503 UNAVAILABLE"));
  });
});

describe("moderarReclamacao - quando a IA falha", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("erro permanente: vai para a revisão humana e grava um registro que as telas reconhecem como falha", async () => {
    generateContentMock.mockRejectedValue(erroDaApi(404, "NOT_FOUND"));

    const resultado = await moderarReclamacao("reclamacao-1", [], {});

    expect(resultado.decisao).toBe("ENCAMINHAR_REVISAO");
    expect(prisma.reclamacao.update).toHaveBeenCalledWith({
      where: { id: "reclamacao-1" },
      data: { status: "AGUARDANDO_REVISAO" },
    });

    const [{ data }] = vi.mocked(prisma.logModeracao.create).mock.calls[0];
    // O contrato que importa: o que a falha grava é o que ehFalhaDaIA() reconhece. Foi essa
    // distância entre quem grava e quem lê que mostrava "nota 1.00" como se fosse da IA.
    expect(ehFalhaDaIA({ scoreGeral: data.scoreGeral, scoreOfensivo: data.scoreOfensivo ?? null })).toBe(
      true
    );
    // E o motivo fica guardado, em vez de só no console do servidor.
    expect(JSON.parse(data.resultadoJson)).toEqual({ falha: "HTTP 404 NOT_FOUND" });
  });

  it("503 que passa na segunda tentativa: a análise sai normal, sem registro de falha", async () => {
    vi.useFakeTimers();
    generateContentMock
      .mockRejectedValueOnce(erroDaApi(503, "UNAVAILABLE"))
      .mockResolvedValueOnce(respostaGemini(scoresBaixosSemImagem));

    const promessa = moderarReclamacao("reclamacao-1", [], {});
    await vi.runAllTimersAsync();
    const resultado = await promessa;

    expect(resultado.decisao).toBe("APROVAR");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    const [{ data }] = vi.mocked(prisma.logModeracao.create).mock.calls[0];
    expect(ehFalhaDaIA({ scoreGeral: data.scoreGeral, scoreOfensivo: data.scoreOfensivo ?? null })).toBe(
      false
    );
  });

  it("análise de verdade com nota 1 (reprovada pela IA) não é tomada por falha", async () => {
    generateContentMock.mockResolvedValue(
      respostaGemini({ ...scoresBaixosSemImagem, scoreOfensivo: 1, justificativa: "Ofensivo." })
    );

    const resultado = await moderarReclamacao("reclamacao-1", [], {});

    expect(resultado.decisao).toBe("REPROVAR");
    const [{ data }] = vi.mocked(prisma.logModeracao.create).mock.calls[0];
    expect(data.scoreGeral).toBe(1);
    expect(ehFalhaDaIA({ scoreGeral: data.scoreGeral, scoreOfensivo: data.scoreOfensivo ?? null })).toBe(
      false
    );
  });
});
