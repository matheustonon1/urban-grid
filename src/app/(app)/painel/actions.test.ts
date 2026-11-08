import { beforeEach, describe, expect, it, vi } from "vitest";

// O que se garante aqui: o reenvio do e-mail de verificação só diz "enviamos" quando o e-mail
// saiu. Antes, a ação ignorava o resultado do envio e a tela confirmava mesmo com o provedor
// recusando (remetente de teste do Resend, domínio não verificado), e a pessoa ficava esperando.

vi.mock("@/auth", () => ({ signOut: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// O tradutor devolve a própria chave: basta para saber qual mensagem a action escolheu.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (chave: string) => chave,
}));

vi.mock("@/lib/seguranca/sessao", () => ({
  exigirSessao: vi.fn(async () => ({ user: { id: "u1" } })),
}));
vi.mock("@/lib/seguranca/limiteCompartilhado", () => ({
  excedeuLimiteCompartilhado: vi.fn(async () => false),
}));
vi.mock("@/lib/email", () => ({
  criarTokenVerificacao: vi.fn(async () => "tok"),
  enviarEmailVerificacao: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const { prisma } = await import("@/lib/prisma");
const { enviarEmailVerificacao, criarTokenVerificacao } = await import("@/lib/email");
const { excedeuLimiteCompartilhado } = await import("@/lib/seguranca/limiteCompartilhado");
const { reenviarVerificacao } = await import("./actions");

const contaNaoVerificada = { id: "u1", email: "pessoa@exemplo.com", emailVerified: null, idioma: "pt-BR" };

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockReset().mockResolvedValue(contaNaoVerificada as never);
  vi.mocked(enviarEmailVerificacao).mockReset().mockResolvedValue({ status: "enviado" });
  vi.mocked(criarTokenVerificacao).mockClear();
  vi.mocked(excedeuLimiteCompartilhado).mockReset().mockResolvedValue(false);
});

describe("reenviarVerificacao", () => {
  it("confirma o envio quando o provedor aceitou", async () => {
    expect(await reenviarVerificacao()).toEqual({
      tipo: "sucesso",
      mensagem: "verificacaoReenviada",
    });
    expect(enviarEmailVerificacao).toHaveBeenCalledWith({
      email: "pessoa@exemplo.com",
      token: "tok",
      locale: "pt-BR",
    });
  });

  it("avisa que não deu quando o provedor recusou, sem repetir o motivo técnico", async () => {
    vi.mocked(enviarEmailVerificacao).mockResolvedValue({
      status: "falhou",
      motivo: "You can only send testing emails to your own email address.",
    });

    const resultado = await reenviarVerificacao();

    expect(resultado).toEqual({ tipo: "erro", mensagem: "erroEnvioVerificacao" });
    expect(JSON.stringify(resultado)).not.toContain("testing emails");
  });

  it("segue como sucesso em dev/CI, onde o envio é simulado de propósito", async () => {
    vi.mocked(enviarEmailVerificacao).mockResolvedValue({ status: "simulado" });

    expect(await reenviarVerificacao()).toEqual({ tipo: "sucesso", mensagem: "verificacaoReenviada" });
  });

  it("não gera token nem envia nada quando o e-mail já está verificado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...contaNaoVerificada,
      emailVerified: new Date(),
    } as never);

    expect(await reenviarVerificacao()).toEqual({ tipo: "info", mensagem: "emailJaVerificado" });
    expect(criarTokenVerificacao).not.toHaveBeenCalled();
    expect(enviarEmailVerificacao).not.toHaveBeenCalled();
  });

  it("não envia nada quando o limite de reenvios foi atingido", async () => {
    vi.mocked(excedeuLimiteCompartilhado).mockResolvedValue(true);

    expect(await reenviarVerificacao()).toEqual({ tipo: "erro", mensagem: "erroMuitosEnvios" });
    expect(enviarEmailVerificacao).not.toHaveBeenCalled();
  });
});
