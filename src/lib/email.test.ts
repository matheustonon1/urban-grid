import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Evita bater no provedor de e-mail de verdade. enviarEmail() (em email.ts)
// só entra no caminho de rede quando RESEND_API_KEY está setada - o valor
// real varia se o .env é carregado ou não pelo runner de teste (vitest não
// carrega .env por padrão), então fixa aqui em vez de depender do ambiente:
// sem isso, o teste passa ou falha de acordo com o que estiver fora dele.
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

import { esc, enviarEmailResumoSemanal, enviarEmailVerificacao } from "./email";

beforeEach(() => {
  enviosCapturados.length = 0;
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("esc", () => {
  it("escapa os caracteres especiais de HTML", () => {
    expect(esc(`<script>alert("x & 'y'")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x &amp; &#39;y&#39;&quot;)&lt;/script&gt;"
    );
  });

  it("não altera texto sem caracteres especiais", () => {
    expect(esc("Prefeitura de São Paulo")).toBe("Prefeitura de São Paulo");
  });

  it("neutraliza uma tentativa de injetar uma tag/link no e-mail", () => {
    const nomeMalicioso = `Órgão</p><a href="https://phishing.exemplo">clique aqui</a><p>`;
    const escapado = esc(nomeMalicioso);
    expect(escapado).not.toContain("<a ");
    expect(escapado).not.toContain("</p>");
    expect(escapado).toContain("&lt;a href=&quot;https://phishing.exemplo&quot;&gt;");
  });
});

describe("enviarEmailVerificacao (idioma)", () => {
  it("sai em português quando locale não é informado (padrão)", async () => {
    await enviarEmailVerificacao({ email: "pessoa@exemplo.com", token: "abc" });

    expect(enviosCapturados).toHaveLength(1);
    expect(enviosCapturados[0].subject).toBe("Confirme seu e-mail — Urban Grid");
    expect(enviosCapturados[0].html).toContain("Verificar e-mail");
  });

  it("sai em inglês quando locale é 'en'", async () => {
    await enviarEmailVerificacao({ email: "pessoa@exemplo.com", token: "abc", locale: "en" });

    expect(enviosCapturados).toHaveLength(1);
    expect(enviosCapturados[0].subject).toBe("Confirm your e-mail — Urban Grid");
    expect(enviosCapturados[0].html).toContain("Verify e-mail");
    expect(enviosCapturados[0].html).not.toContain("Confirme seu e-mail");
  });
});

describe("enviarEmailResumoSemanal (assunto vs. corpo)", () => {
  it("não escapa o assunto (cabeçalho texto puro), mas escapa o corpo HTML", async () => {
    await enviarEmailResumoSemanal({
      email: "pessoa@exemplo.com",
      nomeCidade: "Santa Isabel D'Oeste",
      nomeCategoria: null,
      total: 2,
      url: "http://localhost:3000/cidades/santa-isabel-doeste-pr",
    });

    expect(enviosCapturados).toHaveLength(1);
    // Assunto é cabeçalho de e-mail em texto puro, não HTML - escapar
    // entregaria "D&#39;Oeste" literal na caixa de entrada.
    expect(enviosCapturados[0].subject).toContain("Santa Isabel D'Oeste");
    expect(enviosCapturados[0].subject).not.toContain("&#39;");
    // No corpo (HTML de verdade), o mesmo nome precisa vir escapado.
    expect(enviosCapturados[0].html).toContain("Santa Isabel D&#39;Oeste");
  });
});
