import { beforeEach, describe, expect, it, vi } from "vitest";

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
const { moderarReclamacao } = await import("./index");

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
