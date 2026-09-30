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
const { criarNotificacao } = await import("./notificacoes");

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
      titulo: "Título",
      mensagem: "Mensagem",
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
      titulo: "Título",
      mensagem: "Mensagem",
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
      titulo: "Título",
      mensagem: "Mensagem",
    });

    expect(enviosCapturados).toHaveLength(0);
  });
});
