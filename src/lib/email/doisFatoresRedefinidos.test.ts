import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ver comentário equivalente em index.test.ts: fixa o provedor em vez de depender do .env.
vi.stubEnv("RESEND_API_KEY", "re_teste_fake");

const enviosCapturados: Array<{
  to: string;
  subject: string;
  html: string;
  text?: string;
}> = [];

// O que o "provedor" responde na próxima chamada; o beforeEach volta ao caminho feliz.
const comportamentoDoProvedor: { erro: { message: string } | null } = { erro: null };

vi.mock("resend", () => ({
  // function (e não seta): o código faz `new Resend(...)`, e no Vitest 4+ um mock chamado com `new`
  // precisa ser function ou classe.
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn(async (parametros: (typeof enviosCapturados)[number]) => {
          enviosCapturados.push(parametros);
          return comportamentoDoProvedor.erro
            ? { data: null, error: comportamentoDoProvedor.erro }
            : { data: { id: "teste" }, error: null };
        }),
      },
    };
  }),
}));

import { enviarEmailDoisFatoresRedefinidos } from "./index";

beforeEach(() => {
  enviosCapturados.length = 0;
  comportamentoDoProvedor.erro = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// Alerta de segurança: sai quando um admin redefine o segundo fator de uma conta de órgão.
describe("enviarEmailDoisFatoresRedefinidos", () => {
  it("avisa em português, em tom de alerta, com versão em texto puro e sem link", async () => {
    const resultado = await enviarEmailDoisFatoresRedefinidos({ email: "orgao@curitiba.pr.gov.br" });

    expect(resultado).toEqual({ status: "enviado" });
    const [envio] = enviosCapturados;
    expect(envio.to).toBe("orgao@curitiba.pr.gov.br");
    expect(envio.subject).toContain("segundo fator");
    expect(envio.html).toContain("redefiniu a autenticação em duas etapas");
    expect(envio.html).toContain("troque a sua senha");
    expect(envio.text).toBeTruthy();
    expect(envio.text).not.toMatch(/<[a-z/][^>]*>/i);
  });

  it("sai em inglês quando o destinatário usa inglês", async () => {
    await enviarEmailDoisFatoresRedefinidos({ email: "agency@example.com", locale: "en" });

    expect(enviosCapturados[0].subject).toContain("two-factor");
    expect(enviosCapturados[0].html).toContain("reset two-factor authentication");
  });

  it("devolve 'falhou' quando o provedor recusa (a tela do admin avisa que o e-mail não saiu)", async () => {
    comportamentoDoProvedor.erro = { message: "domínio não verificado" };

    const resultado = await enviarEmailDoisFatoresRedefinidos({ email: "orgao@curitiba.pr.gov.br" });

    expect(resultado).toEqual({ status: "falhou", motivo: "domínio não verificado" });
  });
});
