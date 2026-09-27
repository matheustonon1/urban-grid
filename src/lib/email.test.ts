import { beforeEach, describe, expect, it, vi } from "vitest";

// Evita bater no provedor de e-mail de verdade - o ambiente de teste carrega
// o .env real (RESEND_API_KEY incluída), então sem este mock os testes de
// envio fariam requisições HTTP de verdade pro Resend.
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

import { esc, enviarEmailVerificacao } from "./email";

beforeEach(() => {
  enviosCapturados.length = 0;
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
