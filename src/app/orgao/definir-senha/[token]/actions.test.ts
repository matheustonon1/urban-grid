import { beforeEach, describe, expect, it, vi } from "vitest";

// A corrida real (dois envios do mesmo link ao mesmo tempo) depende do relógio do servidor e nem
// sempre se repete num teste de navegador. Aqui ela é fixada: a leitura inicial diz "conta ainda
// sem senha", e o que muda é o que o banco responde quando a gravação chega.

// next-auth importa `next/server` sem extensão, o que o Node puro (Vitest) não resolve; só o tipo do erro
// importa aqui.
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));

const signIn = vi.fn();
vi.mock("@/auth", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

// O tradutor devolve a própria chave: basta para saber qual mensagem a action escolheu.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (chave: string) => chave,
}));

vi.mock("@/lib/email", () => ({
  criarTokenVerificacao: vi.fn(),
  enviarEmailAcessoOrgao: vi.fn(),
}));
vi.mock("@/lib/seguranca/limiteCompartilhado", () => ({
  excedeuLimiteCompartilhado: vi.fn(async () => false),
}));

const tx = {
  user: { updateMany: vi.fn() },
  verificationToken: { deleteMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (cliente: typeof tx) => unknown) => callback(tx)),
  },
}));

const { prisma } = await import("@/lib/prisma");
const { definirSenhaOrgao } = await import("./actions");

function formulario(senha: string, confirmarSenha = senha) {
  const dados = new FormData();
  dados.set("senha", senha);
  dados.set("confirmarSenha", confirmarSenha);
  return dados;
}

const convite = { token: "tok", identifier: "orgao@curitiba.pr.gov.br", expires: new Date(Date.now() + 60_000) };
const contaSemSenha = { id: "u1", email: "orgao@curitiba.pr.gov.br", papel: "ORGAO", senhaHash: null };

beforeEach(() => {
  signIn.mockReset();
  tx.user.updateMany.mockReset();
  tx.verificationToken.deleteMany.mockReset();
  vi.mocked(prisma.verificationToken.findUnique).mockReset().mockResolvedValue(convite as never);
  vi.mocked(prisma.user.findUnique).mockReset().mockResolvedValue(contaSemSenha as never);
});

describe("definirSenhaOrgao", () => {
  it("define a senha só onde ela ainda é nula, apaga o token e entra na conta", async () => {
    tx.user.updateMany.mockResolvedValue({ count: 1 });

    await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123"));

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", senhaHash: null },
      data: { senhaHash: expect.any(String) },
    });
    expect(tx.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { token: "tok" } });
    expect(signIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ redirectTo: "/painel/conta#seguranca" })
    );
  });

  it("perdeu a corrida (a outra aba gravou entre a leitura e aqui): 'link já usado', sem sobrescrever nem entrar", async () => {
    // A leitura viu a conta sem senha, mas a gravação guardada não achou mais linha nenhuma.
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123"));

    expect(resultado).toEqual({ mensagem: "erroLinkUsado" });
    // Não mexe no token (o da vencedora já foi apagado) e não abre sessão para a perdedora.
    expect(tx.verificationToken.deleteMany).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("conta que já tem senha na leitura inicial: 'link já usado' sem abrir transação", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...contaSemSenha, senhaHash: "hash" } as never);

    const resultado = await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123"));

    expect(resultado).toEqual({ mensagem: "erroLinkUsado" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("token inexistente (já consumido) ou vencido: avisa sem tocar na conta", async () => {
    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(null);
    expect(await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123"))).toEqual({
      mensagem: "erroLinkExpirado",
    });

    vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue({
      ...convite,
      expires: new Date(Date.now() - 1_000),
    } as never);
    expect(await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123"))).toEqual({
      mensagem: "erroLinkExpirado",
    });

    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("senha curta ou confirmação diferente: erro de campo, nada é lido nem gravado", async () => {
    const curta = await definirSenhaOrgao("tok", undefined, formulario("curta"));
    expect(curta?.erros?.senha).toEqual(["erroSenhaCurta"]);

    const diferente = await definirSenhaOrgao("tok", undefined, formulario("SenhaForte123", "Outra1234"));
    expect(diferente?.erros?.confirmarSenha).toEqual(["erroSenhasDiferentes"]);

    expect(prisma.verificationToken.findUnique).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});
