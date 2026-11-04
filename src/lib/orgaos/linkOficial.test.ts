import { describe, expect, it } from "vitest";

import { hostDoLink, normalizarLinkOficial } from "./linkOficial";

describe("normalizarLinkOficial", () => {
  it("aceita o endereço com ou sem esquema e o padroniza", () => {
    expect(normalizarLinkOficial("https://www.saolucas.sp.gov.br/")).toBe(
      "https://www.saolucas.sp.gov.br"
    );
    expect(normalizarLinkOficial("saolucas.sp.gov.br")).toBe("https://saolucas.sp.gov.br");
    expect(normalizarLinkOficial("  HTTP://Prefeitura.Exemplo.com.br/secretarias/obras/  ")).toBe(
      "http://prefeitura.exemplo.com.br/secretarias/obras"
    );
  });

  it("descarta consulta, âncora e credenciais: o link é para o admin abrir e conferir", () => {
    expect(normalizarLinkOficial("https://a.gov.br/pagina?utm_source=x#topo")).toBe(
      "https://a.gov.br/pagina"
    );
    expect(normalizarLinkOficial("https://usuario:senha@a.gov.br/x")).toBe("https://a.gov.br/x");
  });

  it("mantém a porta quando há", () => {
    expect(normalizarLinkOficial("https://a.gov.br:8443/x")).toBe("https://a.gov.br:8443/x");
  });

  it("recusa esquema que não é web", () => {
    expect(normalizarLinkOficial("javascript:alert(1)")).toBeNull();
    expect(normalizarLinkOficial("data:text/html,<script>1</script>")).toBeNull();
    expect(normalizarLinkOficial("ftp://a.gov.br/x")).toBeNull();
    expect(normalizarLinkOficial("file:///etc/passwd")).toBeNull();
  });

  it("recusa IP, localhost e domínio sem ponto", () => {
    expect(normalizarLinkOficial("http://127.0.0.1/admin")).toBeNull();
    expect(normalizarLinkOficial("http://[::1]/")).toBeNull();
    expect(normalizarLinkOficial("http://localhost:3000")).toBeNull();
    expect(normalizarLinkOficial("intranet")).toBeNull();
  });

  it("recusa vazio, domínio malformado e tamanho excessivo", () => {
    expect(normalizarLinkOficial("")).toBeNull();
    expect(normalizarLinkOficial("   ")).toBeNull();
    expect(normalizarLinkOficial("a..gov.br")).toBeNull();
    expect(normalizarLinkOficial("não é um site")).toBeNull();
    expect(normalizarLinkOficial(`https://a.gov.br/${"x".repeat(600)}`)).toBeNull();
  });
});

describe("hostDoLink", () => {
  it("extrai o domínio de um link normalizado", () => {
    expect(hostDoLink("https://www.saolucas.sp.gov.br/obras")).toBe("www.saolucas.sp.gov.br");
    expect(hostDoLink("isto não é um link")).toBe("");
  });
});
