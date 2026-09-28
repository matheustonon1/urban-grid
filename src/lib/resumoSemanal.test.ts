import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ver comentário equivalente em email.test.ts - fixa RESEND_API_KEY em vez
// de depender do que o .env real tiver (ou não) nesta execução.
vi.stubEnv("RESEND_API_KEY", "re_teste_fake");

const enviosCapturados: Array<{ to: string; subject: string; html: string }> = [];

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(async (parametros: { to: string; subject: string; html: string }) => {
        enviosCapturados.push(parametros);
        return { data: { id: "teste" }, error: null };
      }),
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assinaturaCidade: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    reclamacao: {
      count: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { enviarResumosSemanaisPendentes } = await import("./resumoSemanal");

beforeEach(() => {
  enviosCapturados.length = 0;
  vi.mocked(prisma.assinaturaCidade.findMany).mockReset();
  vi.mocked(prisma.assinaturaCidade.update).mockReset();
  vi.mocked(prisma.reclamacao.count).mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const assinaturaBase = {
  id: "assinatura-1",
  cidadeId: "cidade-1",
  categoriaId: null,
  ultimoEnvioEm: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  user: { email: "pessoa@exemplo.com", idioma: "pt-BR" },
  cidade: { nome: "Curitiba", slug: "curitiba-pr" },
  categoria: null,
};

describe("enviarResumosSemanaisPendentes", () => {
  it("envia o resumo quando há reclamação nova e marca ultimoEnvioEm", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([assinaturaBase] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(3);

    const resultado = await enviarResumosSemanaisPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 1 });
    expect(enviosCapturados).toHaveLength(1);
    expect(enviosCapturados[0].subject).toContain("Curitiba");
    expect(enviosCapturados[0].html).toContain("3");
    expect(prisma.assinaturaCidade.update).toHaveBeenCalledWith({
      where: { id: "assinatura-1" },
      data: { ultimoEnvioEm: expect.any(Date) },
    });
  });

  it("não envia e-mail quando não há reclamação nova, mas ainda marca como processada", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([assinaturaBase] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(0);

    const resultado = await enviarResumosSemanaisPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 0 });
    expect(enviosCapturados).toHaveLength(0);
    expect(prisma.assinaturaCidade.update).toHaveBeenCalledTimes(1);
  });

  it("filtra reclamações por categoria quando a assinatura tem uma", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([
      {
        ...assinaturaBase,
        categoriaId: "categoria-1",
        categoria: { nome: "Buracos e pavimentação", slug: "buracos-e-pavimentacao" },
      },
    ] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(1);

    await enviarResumosSemanaisPendentes();

    expect(prisma.reclamacao.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoriaId: "categoria-1" }),
      })
    );
  });

  it("traduz o nome da categoria pro idioma do destinatário", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([
      {
        ...assinaturaBase,
        user: { email: "pessoa@exemplo.com", idioma: "en" },
        categoriaId: "categoria-1",
        categoria: { nome: "Buracos e pavimentação", slug: "buracos-e-pavimentacao" },
      },
    ] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(2);

    await enviarResumosSemanaisPendentes();

    expect(enviosCapturados).toHaveLength(1);
    expect(enviosCapturados[0].html).toContain("Potholes and paving");
    expect(enviosCapturados[0].html).not.toContain("Buracos");
  });

  it("não inclui usuário banido no momento na consulta de assinaturas elegíveis", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([]);

    await enviarResumosSemanaisPendentes();

    expect(prisma.assinaturaCidade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            ativo: true,
            OR: [{ banidoAte: null }, { banidoAte: { lte: expect.any(Date) } }],
          }),
        }),
      })
    );
  });

  it("sem assinaturas elegíveis, não processa nada", async () => {
    vi.mocked(prisma.assinaturaCidade.findMany).mockResolvedValue([]);

    const resultado = await enviarResumosSemanaisPendentes();

    expect(resultado).toEqual({ processadas: 0, comConteudo: 0 });
    expect(enviosCapturados).toHaveLength(0);
  });
});
