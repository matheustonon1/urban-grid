import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesma garantia de painel/actions.test.ts para o botão de "Minha conta": só confirma o envio do
// e-mail de verificação quando ele saiu.

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
vi.mock("@/lib/notificacoes", () => ({
  alertarSenhaAlterada: vi.fn(),
  alertarTrocaEmailSolicitada: vi.fn(),
}));
vi.mock("@/lib/conta/senhaAtual", () => ({ verificarSenhaAtual: vi.fn() }));
vi.mock("@/lib/email", () => ({
  apagarTokensPendentes: vi.fn(),
  criarTokenTrocaEmail: vi.fn(),
  criarTokenVerificacao: vi.fn(async () => "tok"),
  enviarEmailConfirmarTrocaEmail: vi.fn(),
  enviarEmailVerificacao: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const { prisma } = await import("@/lib/prisma");
const { enviarEmailVerificacao, criarTokenVerificacao } = await import("@/lib/email");
const { excedeuLimiteCompartilhado } = await import("@/lib/seguranca/limiteCompartilhado");
const { reenviarVerificacaoEmail } = await import("./actions");

const contaNaoVerificada = { email: "pessoa@exemplo.com", emailVerified: null, idioma: "pt-BR" };

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockReset().mockResolvedValue(contaNaoVerificada as never);
  vi.mocked(enviarEmailVerificacao).mockReset().mockResolvedValue({ status: "enviado" });
  vi.mocked(criarTokenVerificacao).mockClear();
  vi.mocked(excedeuLimiteCompartilhado).mockReset().mockResolvedValue(false);
});

describe("reenviarVerificacaoEmail", () => {
  it("confirma o envio quando o provedor aceitou", async () => {
    expect(await reenviarVerificacaoEmail()).toEqual({
      tipo: "sucesso",
      mensagem: "verificacaoReenviada",
    });
  });

  it("avisa que não deu quando o provedor recusou, sem repetir o motivo técnico", async () => {
    vi.mocked(enviarEmailVerificacao).mockResolvedValue({
      status: "falhou",
      motivo: "You can only send testing emails to your own email address.",
    });

    const resultado = await reenviarVerificacaoEmail();

    expect(resultado).toEqual({ mensagem: "erroEnvioVerificacao" });
    expect(JSON.stringify(resultado)).not.toContain("testing emails");
  });

  it("segue como sucesso em dev/CI, onde o envio é simulado de propósito", async () => {
    vi.mocked(enviarEmailVerificacao).mockResolvedValue({ status: "simulado" });

    expect(await reenviarVerificacaoEmail()).toEqual({
      tipo: "sucesso",
      mensagem: "verificacaoReenviada",
    });
  });

  it("não envia nada quando o e-mail já está verificado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...contaNaoVerificada,
      emailVerified: new Date(),
    } as never);

    expect(await reenviarVerificacaoEmail()).toEqual({ tipo: "info", mensagem: "emailJaVerificado" });
    expect(criarTokenVerificacao).not.toHaveBeenCalled();
    expect(enviarEmailVerificacao).not.toHaveBeenCalled();
  });

  it("não envia nada quando o limite de reenvios foi atingido", async () => {
    vi.mocked(excedeuLimiteCompartilhado).mockResolvedValue(true);

    expect(await reenviarVerificacaoEmail()).toEqual({ mensagem: "erroMuitosEnvios" });
    expect(enviarEmailVerificacao).not.toHaveBeenCalled();
  });
});
