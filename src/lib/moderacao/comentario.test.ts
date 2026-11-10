import { beforeEach, describe, expect, it, vi } from "vitest";

import { ehFalhaDaIA } from "./falha";

// Mocka o cliente Gemini e o prisma, sem chamar nenhum dos dois de verdade.
const generateContentMock = vi.fn();

vi.mock("./gemini", () => ({
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
}));
vi.mock("@/lib/notificacoes", () => ({ criarNotificacao: vi.fn() }));
vi.mock("@/lib/notificacoes/orgaos", () => ({ avisarOrgaosDaPublicacao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { logModeracao: { create: vi.fn() } },
}));

const { prisma } = await import("@/lib/prisma");
const { moderarComentario } = await import("./comentario");

function erroDaApi(status: number, situacao: string) {
  return Object.assign(
    new Error(JSON.stringify({ error: { code: status, message: "falha simulada", status: situacao } })),
    { name: "ApiError", status }
  );
}

beforeEach(() => {
  generateContentMock.mockReset();
  vi.mocked(prisma.logModeracao.create).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function registroGravado() {
  const [{ data }] = vi.mocked(prisma.logModeracao.create).mock.calls[0];
  return data;
}

describe("moderarComentario - quando a IA falha", () => {
  it("oculta o comentário (REPROVAR) e grava um registro que as telas reconhecem como falha", async () => {
    generateContentMock.mockRejectedValue(erroDaApi(404, "NOT_FOUND"));

    const decisao = await moderarComentario("comentario-1", "Texto do comentário.");

    // Falha no lado seguro: fica oculto até um moderador olhar, nunca publicado sem análise.
    expect(decisao).toBe("REPROVAR");
    const data = registroGravado();
    expect(ehFalhaDaIA({ scoreGeral: data.scoreGeral, scoreOfensivo: data.scoreOfensivo ?? null })).toBe(
      true
    );
    expect(JSON.parse(data.resultadoJson)).toEqual({ falha: "HTTP 404 NOT_FOUND" });
  });

  it("reprovação de verdade da IA (mesmo com nota 1) não é tomada por falha", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        scoreOfensivo: 1,
        scoreSpam: 0,
        scoreDadosPessoais: 0,
        justificativa: "Ofensivo.",
      }),
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    const decisao = await moderarComentario("comentario-1", "Texto ofensivo.");

    expect(decisao).toBe("REPROVAR");
    const data = registroGravado();
    expect(data.scoreGeral).toBe(1);
    expect(ehFalhaDaIA({ scoreGeral: data.scoreGeral, scoreOfensivo: data.scoreOfensivo ?? null })).toBe(
      false
    );
  });
});
