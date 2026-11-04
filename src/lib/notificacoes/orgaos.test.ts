import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamacao: { findUnique: vi.fn() },
    orgao: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));
vi.mock("./index", () => ({ criarNotificacao: vi.fn() }));

const { prisma } = await import("@/lib/prisma");
const { criarNotificacao } = await import("./index");
const { avisarOrgaosDaPublicacao } = await import("./orgaos");

const reclamacao = {
  titulo: "Buraco na Avenida Brasil",
  protocolo: "RC-2026-0000042",
  cidadeId: "cidade-1",
  categoriaId: "cat-1",
  autor: { orgaoId: null as string | null },
};

beforeEach(() => {
  vi.mocked(prisma.reclamacao.findUnique).mockReset();
  vi.mocked(prisma.orgao.findMany).mockReset();
  vi.mocked(prisma.user.findMany).mockReset();
  vi.mocked(criarNotificacao).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("avisarOrgaosDaPublicacao", () => {
  it("avisa cada conta ativa dos órgãos que atendem a cidade e a categoria", async () => {
    vi.mocked(prisma.reclamacao.findUnique).mockResolvedValue(reclamacao as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([{ id: "orgao-1" }, { id: "orgao-2" }] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }, { id: "u2" }] as never);

    await avisarOrgaosDaPublicacao("rec-1");

    expect(criarNotificacao).toHaveBeenCalledTimes(2);
    expect(criarNotificacao).toHaveBeenCalledWith({
      userId: "u1",
      tipo: "NOVA_RECLAMACAO_NA_FILA",
      texto: { chave: "novaReclamacaoNaFila", params: { titulo: "Buraco na Avenida Brasil" } },
      reclamacaoId: "rec-1",
      protocolo: "RC-2026-0000042",
    });
  });

  it("procura órgãos ativos da cidade que atendem a categoria ou atendem qualquer uma", async () => {
    vi.mocked(prisma.reclamacao.findUnique).mockResolvedValue(reclamacao as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([] as never);

    await avisarOrgaosDaPublicacao("rec-1");

    expect(prisma.orgao.findMany).toHaveBeenCalledWith({
      where: {
        cidadeId: "cidade-1",
        ativo: true,
        OR: [{ categorias: { none: {} } }, { categorias: { some: { id: "cat-1" } } }],
      },
      select: { id: true },
    });
    // Sem órgão atendendo, ninguém a avisar (nem consulta de contas).
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(criarNotificacao).not.toHaveBeenCalled();
  });

  it("deixa de fora o órgão da conta que abriu a reclamação (ele não responde ao que abriu)", async () => {
    vi.mocked(prisma.reclamacao.findUnique).mockResolvedValue({
      ...reclamacao,
      autor: { orgaoId: "orgao-9" },
    } as never);
    vi.mocked(prisma.orgao.findMany).mockResolvedValue([] as never);

    await avisarOrgaosDaPublicacao("rec-1");

    expect(prisma.orgao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "orgao-9" } }),
      })
    );
  });

  it("não faz nada quando a reclamação não existe", async () => {
    vi.mocked(prisma.reclamacao.findUnique).mockResolvedValue(null);

    await avisarOrgaosDaPublicacao("rec-fantasma");

    expect(prisma.orgao.findMany).not.toHaveBeenCalled();
    expect(criarNotificacao).not.toHaveBeenCalled();
  });

  it("nunca lança: uma falha do banco não pode virar erro para quem publicou", async () => {
    vi.mocked(prisma.reclamacao.findUnique).mockRejectedValue(new Error("banco fora do ar"));

    await expect(avisarOrgaosDaPublicacao("rec-1")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
