import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo motivo de resumoSemanal.test.ts/email.test.ts - fixa a env em vez
// de depender do que o .env real tiver (ou não) nesta execução.
vi.stubEnv("RESEND_API_KEY", "re_teste_fake");

const enviosCapturados: Array<{ to: string; subject: string }> = [];

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn(async (parametros: { to: string; subject: string }) => {
        enviosCapturados.push(parametros);
        return { data: { id: "teste" }, error: null };
      }),
    },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificacao: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { criarNotificacao } = await import("./index");

beforeEach(() => {
  enviosCapturados.length = 0;
  vi.mocked(prisma.notificacao.create).mockReset().mockResolvedValue({} as never);
  vi.mocked(prisma.user.findUnique).mockReset();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("criarNotificacao", () => {
  it("com notificarPorEmail=true e e-mail verificado, envia o e-mail", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "usuario@example.com",
      emailVerified: new Date(),
      idioma: "pt-BR",
      notificarPorEmail: true,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "RESPOSTA_OFICIAL",
      texto: { chave: "respostaOficial", params: { orgao: "Órgão" }, mensagemBruta: "Mensagem" },
    });

    expect(enviosCapturados).toHaveLength(1);
  });

  // notificarPorEmail=false só desliga o e-mail - o registro no sininho
  // (prisma.notificacao.create) precisa continuar acontecendo de
  // qualquer forma, por isso a asserção confere os dois.
  it("com notificarPorEmail=false, cria a notificação mas não envia e-mail", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "usuario@example.com",
      emailVerified: new Date(),
      idioma: "pt-BR",
      notificarPorEmail: false,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "RESPOSTA_OFICIAL",
      texto: { chave: "respostaOficial", params: { orgao: "Órgão" }, mensagemBruta: "Mensagem" },
    });

    expect(prisma.notificacao.create).toHaveBeenCalledOnce();
    expect(enviosCapturados).toHaveLength(0);
  });

  it("tipo fora de TIPOS_COM_EMAIL nunca envia e-mail, mesmo com notificarPorEmail=true", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "usuario@example.com",
      emailVerified: new Date(),
      idioma: "pt-BR",
      notificarPorEmail: true,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "NOVO_COMENTARIO",
      texto: { chave: "novoComentario", mensagemBruta: "Mensagem" },
    });

    expect(enviosCapturados).toHaveLength(0);
  });

  // O texto sai no idioma de QUEM RECEBE (User.idioma), não no de quem disparou: o
  // moderador que arquiva a reclamação pode estar em português e o autor em inglês.
  it("grava o título e a mensagem no idioma do destinatário", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@example.com",
      emailVerified: new Date(),
      idioma: "en",
      notificarPorEmail: false,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "RECLAMACAO_PUBLICADA",
      texto: { chave: "reclamacaoPublicada", params: { titulo: "Buraco na rua" } },
    });

    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: "Complaint published",
        mensagem: 'Your complaint "Buraco na rua" was published.',
      }),
    });
  });

  it("sem idioma gravado, cai no português", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "usuario@example.com",
      emailVerified: null,
      idioma: null,
      notificarPorEmail: false,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "RECLAMACAO_PUBLICADA",
      texto: { chave: "reclamacaoPublicada", params: { titulo: "Buraco" } },
    });

    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ titulo: "Reclamação publicada" }),
    });
  });

  it("mensagem escrita por uma pessoa não é traduzida - só o título", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "user@example.com",
      emailVerified: null,
      idioma: "en",
      notificarPorEmail: false,
    } as never);

    await criarNotificacao({
      userId: "u1",
      tipo: "RESPOSTA_OFICIAL",
      texto: {
        chave: "respostaOficial",
        params: { orgao: "Secretaria de Obras" },
        mensagemBruta: "Equipe vai ao local na segunda.",
      },
    });

    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        titulo: "Secretaria de Obras answered your complaint",
        mensagem: "Equipe vai ao local na segunda.",
      }),
    });
  });

  // Se ler o destinatário falhar, a notificação sai mesmo assim (idioma padrão) e
  // só o e-mail fica de fora - quem chamou já commitou a mudança de estado.
  it("falha ao ler o destinatário não impede a notificação", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("banco fora"));

    await criarNotificacao({
      userId: "u1",
      tipo: "RESPOSTA_OFICIAL",
      texto: { chave: "senhaAlterada" },
    });

    expect(prisma.notificacao.create).toHaveBeenCalledOnce();
    expect(enviosCapturados).toHaveLength(0);
  });
});
