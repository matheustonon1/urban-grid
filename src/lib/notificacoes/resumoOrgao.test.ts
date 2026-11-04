import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ver comentário equivalente em resumoSemanal.test.ts: fixa o provedor em vez de depender do .env.
vi.stubEnv("RESEND_API_KEY", "re_teste_fake");

const enviosCapturados: Array<{ to: string; subject: string; html: string; text?: string }> = [];
// Liga a recusa do provedor (domínio não verificado, fora do ar) nos testes que a exercitam.
let provedorRecusa = false;
// Se definido, o provedor recusa só os envios para este endereço.
let recusarPara: string | null = null;

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn(async (parametros: { to: string; subject: string; html: string }) => {
          if (provedorRecusa || parametros.to === recusarPara) {
            return { data: null, error: { message: "domínio não verificado" } };
          }
          enviosCapturados.push(parametros);
          return { data: { id: "teste" }, error: null };
        }),
      },
    };
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), update: vi.fn() },
    reclamacao: { count: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { enviarResumosDeOrgaosPendentes } = await import("./resumoOrgao");
const { INTERVALO_MINIMO_RESUMO_MS } = await import("./resumoSemanal");

beforeEach(() => {
  provedorRecusa = false;
  recusarPara = null;
  enviosCapturados.length = 0;
  vi.mocked(prisma.user.findMany).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.reclamacao.count).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const orgao = {
  id: "orgao-1",
  nome: "Secretaria de Obras",
  cidadeId: "cidade-1",
  cidade: { nome: "Curitiba" },
  categorias: [{ id: "cat-1" }],
};

const conta = (id: string, extra: object = {}) => ({
  id,
  email: `${id}@curitiba.pr.gov.br`,
  idioma: "pt-BR",
  orgao,
  ...extra,
});

// count é chamado três vezes por órgão, nesta ordem: sem resposta, novas (7 dias), vencidas.
function contagens(semResposta: number, novas: number, vencidas: number) {
  vi.mocked(prisma.reclamacao.count)
    .mockResolvedValueOnce(semResposta)
    .mockResolvedValueOnce(novas)
    .mockResolvedValueOnce(vencidas);
}

describe("enviarResumosDeOrgaosPendentes", () => {
  it("envia o resumo com os três números e marca a semana", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(12, 4, 3);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 1, falhas: 0 });
    expect(enviosCapturados).toHaveLength(1);
    expect(enviosCapturados[0].to).toBe("ana@curitiba.pr.gov.br");
    expect(enviosCapturados[0].subject).toContain("12 reclamações aguardam");
    expect(enviosCapturados[0].html).toContain("Secretaria de Obras");
    expect(enviosCapturados[0].html).toContain("4 delas chegaram nos últimos 7 dias");
    expect(enviosCapturados[0].html).toContain("3 esperam há mais de 15 dias");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "ana" },
      data: { ultimoResumoOrgaoEm: expect.any(Date) },
    });
  });

  it("provedor recusou o e-mail: não marca a conta (volta na próxima execução) e conta a falha", async () => {
    provedorRecusa = true;
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(12, 4, 3);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 0, falhas: 1 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("a recusa de uma conta não impede marcar as outras do lote", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      conta("ana"),
      conta("bia", { orgao: { ...orgao, id: "orgao-2" } }),
    ] as never);
    vi.mocked(prisma.reclamacao.count).mockResolvedValue(2);
    recusarPara = "ana@curitiba.pr.gov.br";

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 2, comConteudo: 1, falhas: 1 });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "bia" },
      data: { ultimoResumoOrgaoEm: expect.any(Date) },
    });
  });

  it("fila zerada com o provedor fora do ar não é falha: marca a semana", async () => {
    provedorRecusa = true;
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(0, 0, 0);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 0, falhas: 0 });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it("a fila é a mesma do painel: escopo, abertas e sem resposta alguma", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(1, 0, 0);

    await enviarResumosDeOrgaosPendentes();

    expect(vi.mocked(prisma.reclamacao.count).mock.calls[0][0]).toEqual({
      where: {
        cidadeId: "cidade-1",
        categoriaId: { in: ["cat-1"] },
        autor: { OR: [{ orgaoId: null }, { orgaoId: { not: "orgao-1" } }] },
        status: { in: ["PUBLICADA", "EM_ANDAMENTO"] },
        respostas: { none: {} },
      },
    });
  });

  it("não manda e-mail com a fila zerada, mas marca a semana (ritmo semanal)", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(0, 0, 0);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 1, comConteudo: 0, falhas: 0 });
    expect(enviosCapturados).toHaveLength(0);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it("não cita 'esperam há mais de 15 dias' quando nenhuma passou do prazo", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana")] as never);
    contagens(2, 2, 0);

    await enviarResumosDeOrgaosPendentes();

    expect(enviosCapturados[0].html).not.toContain("mais de 15 dias");
  });

  it("duas contas do mesmo órgão compartilham a fila: conta uma vez, manda dois e-mails", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([conta("ana"), conta("bia")] as never);
    contagens(5, 1, 0);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 2, comConteudo: 2, falhas: 0 });
    expect(prisma.reclamacao.count).toHaveBeenCalledTimes(3);
    expect(enviosCapturados.map((e) => e.to).sort()).toEqual([
      "ana@curitiba.pr.gov.br",
      "bia@curitiba.pr.gov.br",
    ]);
  });

  it("órgão sem categoria atribuída atende qualquer uma (sem filtro de categoria)", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      conta("ana", { orgao: { ...orgao, categorias: [] } }),
    ] as never);
    contagens(1, 0, 0);

    await enviarResumosDeOrgaosPendentes();

    expect(vi.mocked(prisma.reclamacao.count).mock.calls[0][0]?.where).not.toHaveProperty(
      "categoriaId"
    );
  });

  it("só pega conta de órgão ativa, com e-mail verificado, que aceita e-mail e não está banida", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const antes = Date.now();
    await enviarResumosDeOrgaosPendentes();

    const consulta = vi.mocked(prisma.user.findMany).mock.calls[0][0]!;
    expect(consulta.where).toMatchObject({
      papel: "ORGAO",
      ativo: true,
      emailVerified: { not: null },
      notificarPorEmail: true,
      orgao: { ativo: true },
    });
    const [banimento, ultimoEnvio] = (consulta.where as { AND: unknown[] }).AND as Array<{
      OR: unknown[];
    }>;
    expect(banimento.OR).toEqual([{ banidoAte: null }, { banidoAte: { lte: expect.any(Date) } }]);
    // Elegível: nunca recebeu, ou recebeu há 6 dias ou mais (folga contra a variação do cron).
    const corte = (ultimoEnvio.OR[1] as { ultimoResumoOrgaoEm: { lte: Date } }).ultimoResumoOrgaoEm
      .lte;
    expect(ultimoEnvio.OR[0]).toEqual({ ultimoResumoOrgaoEm: null });
    expect(Math.abs(antes - corte.getTime() - INTERVALO_MINIMO_RESUMO_MS)).toBeLessThan(5_000);
  });

  it("uma conta que falha não impede as outras (e ainda assim é marcada)", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      conta("ana"),
      conta("bia", { orgao: { ...orgao, id: "orgao-2" } }),
    ] as never);
    vi.mocked(prisma.reclamacao.count)
      .mockRejectedValueOnce(new Error("banco"))
      .mockRejectedValueOnce(new Error("banco"))
      .mockRejectedValueOnce(new Error("banco"))
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const resultado = await enviarResumosDeOrgaosPendentes();

    expect(resultado).toEqual({ processadas: 2, comConteudo: 1, falhas: 0 });
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it("sem contas elegíveis, não processa nada", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    expect(await enviarResumosDeOrgaosPendentes()).toEqual({
      processadas: 0,
      comConteudo: 0,
      falhas: 0,
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
