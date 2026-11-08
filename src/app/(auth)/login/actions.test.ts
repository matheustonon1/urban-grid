import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class FalhaDeAutenticacao extends Error {}
  return {
    FalhaDeAutenticacao,
    signIn: vi.fn(),
    buscarUsuarioPorIdentificador: vi.fn(),
    usuarioBloqueadoPorLogin: vi.fn(() => false),
    gastarTempoDeComparacao: vi.fn(),
  };
});

// `next-auth` importa `next/server` sem extensão, que o Node puro do Vitest não resolve.
vi.mock("next-auth", () => ({ AuthError: mocks.FalhaDeAutenticacao }));
vi.mock("@/auth", () => ({ signIn: mocks.signIn }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (chave: string) => chave }));
vi.mock("@/lib/conta/identificador", () => ({
  buscarUsuarioPorIdentificador: mocks.buscarUsuarioPorIdentificador,
}));
vi.mock("@/lib/seguranca/loginSeguranca", () => ({
  usuarioBloqueadoPorLogin: mocks.usuarioBloqueadoPorLogin,
}));
vi.mock("@/lib/seguranca/hashFalso", () => ({
  gastarTempoDeComparacao: mocks.gastarTempoDeComparacao,
}));

const { login } = await import("./actions");

const SENHA = "SenhaCorreta123";
const SENHA_ERRADA = "SenhaErrada456";
const IDENTIFICADOR = "adm.teste@exemplo.com";
const hash = bcrypt.hashSync(SENHA, 4);

const contaComDoisFatores = {
  senhaHash: hash,
  totpConfirmadoEm: new Date(),
  papel: "ADMIN",
  banidoAte: null,
};
const contaSemDoisFatores = { ...contaComDoisFatores, totpConfirmadoEm: null };

function dados(campos: Record<string, string>) {
  const formData = new FormData();
  for (const [nome, valor] of Object.entries(campos)) formData.set(nome, valor);
  return formData;
}

// O que a pessoa digitou não pode voltar na resposta da ação (nem a senha, nem o e-mail).
function semEco(resultado: unknown) {
  const texto = JSON.stringify(resultado);
  expect(texto).not.toContain(SENHA);
  expect(texto).not.toContain(SENHA_ERRADA);
  expect(texto).not.toContain(IDENTIFICADOR);
}

beforeEach(() => {
  mocks.signIn.mockReset();
  mocks.buscarUsuarioPorIdentificador.mockReset();
  mocks.gastarTempoDeComparacao.mockReset();
  mocks.usuarioBloqueadoPorLogin.mockReturnValue(false);
});

describe("login: conta com 2FA", () => {
  it("senha ERRADA: já responde 'inválidos', sem mostrar o campo do 2FA", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaComDoisFatores);
    mocks.signIn.mockRejectedValue(new mocks.FalhaDeAutenticacao());

    const resultado = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA_ERRADA }));

    expect(resultado).toEqual({ erro: "erroCredenciaisInvalidas", etapaTotp: false });
    // O signIn roda mesmo assim: é o authorize() que conta a falha no limite de tentativas.
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    semEco(resultado);
  });

  it("senha CERTA e sem código: pede o código, sem tentar entrar e sem devolver a senha", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaComDoisFatores);

    const resultado = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA }));

    expect(resultado).toEqual({ etapaTotp: true });
    expect(mocks.signIn).not.toHaveBeenCalled();
    semEco(resultado);
  });

  it("senha certa e código ERRADO: avisa e continua pedindo o código, sem devolver a senha", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaComDoisFatores);
    mocks.signIn.mockRejectedValue(new mocks.FalhaDeAutenticacao());

    const resultado = await login(
      undefined,
      dados({ identificador: IDENTIFICADOR, senha: SENHA, codigoTotp: "000000" })
    );

    expect(resultado).toEqual({ erro: "erroCredenciaisOuCodigoInvalidos", etapaTotp: true });
    semEco(resultado);
  });

  it("trocar a senha por uma errada no passo do código: o campo do código some", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaComDoisFatores);
    mocks.signIn.mockRejectedValue(new mocks.FalhaDeAutenticacao());

    const resultado = await login(
      undefined,
      dados({ identificador: IDENTIFICADOR, senha: SENHA_ERRADA, codigoTotp: "123456" })
    );

    expect(resultado).toEqual({ erro: "erroCredenciaisInvalidas", etapaTotp: false });
    semEco(resultado);
  });
});

describe("login: contas sem 2FA e identificadores que não existem", () => {
  it("conta sem 2FA, senha errada: 'inválidos', nunca o campo do código", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaSemDoisFatores);
    mocks.signIn.mockRejectedValue(new mocks.FalhaDeAutenticacao());

    const resultado = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA_ERRADA }));

    expect(resultado).toEqual({ erro: "erroCredenciaisInvalidas", etapaTotp: false });
    semEco(resultado);
  });

  it("identificador que não existe responde igual a senha errada e gasta o mesmo tempo", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(null);
    mocks.signIn.mockRejectedValue(new mocks.FalhaDeAutenticacao());

    const resultado = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA_ERRADA }));

    expect(resultado).toEqual({ erro: "erroCredenciaisInvalidas", etapaTotp: false });
    expect(mocks.gastarTempoDeComparacao).toHaveBeenCalledWith(SENHA_ERRADA);
    semEco(resultado);
  });

  it("conta suspensa e excesso de tentativas têm mensagem própria, também sem eco", async () => {
    mocks.buscarUsuarioPorIdentificador.mockResolvedValue({
      ...contaComDoisFatores,
      banidoAte: new Date(Date.now() + 86_400_000),
    });
    const suspensa = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA }));
    expect(suspensa).toEqual({ erro: "erroContaSuspensa" });
    semEco(suspensa);

    mocks.buscarUsuarioPorIdentificador.mockResolvedValue(contaComDoisFatores);
    mocks.usuarioBloqueadoPorLogin.mockReturnValue(true);
    const bloqueada = await login(undefined, dados({ identificador: IDENTIFICADOR, senha: SENHA }));
    expect(bloqueada).toEqual({ erro: "erroMuitasTentativas" });
    semEco(bloqueada);
  });
});
