import { describe, expect, it } from "vitest";

import { caminhoInternoSeguro, destinoPosLogin } from "./destinoLogin";

describe("caminhoInternoSeguro", () => {
  it("aceita caminho interno, com query e âncora", () => {
    expect(caminhoInternoSeguro("/orgao")).toBe("/orgao");
    expect(caminhoInternoSeguro("/reclamacoes/RC-2026-0000001?erro=x#respostas")).toBe(
      "/reclamacoes/RC-2026-0000001?erro=x#respostas"
    );
    expect(caminhoInternoSeguro("  /moderacao  ")).toBe("/moderacao");
  });

  it.each([
    ["URL absoluta", "https://golpe.com"],
    ["protocolo relativo", "//golpe.com"],
    ["protocolo relativo com barra invertida", "/\\golpe.com"],
    ["barra invertida no meio", "/ok\\golpe"],
    ["tab que o navegador descarta", "/\t/golpe.com"],
    ["quebra de linha", "/\n/golpe.com"],
    ["javascript:", "javascript:alert(1)"],
    ["sem barra inicial", "orgao"],
    ["vazio", ""],
  ])("recusa %s", (_nome, valor) => {
    expect(caminhoInternoSeguro(valor)).toBeNull();
  });

  it("recusa o que não é texto", () => {
    expect(caminhoInternoSeguro(undefined)).toBeNull();
    expect(caminhoInternoSeguro(null)).toBeNull();
    expect(caminhoInternoSeguro(["/orgao"])).toBeNull();
    expect(caminhoInternoSeguro(42)).toBeNull();
  });

  it("não devolve a pessoa ao login nem ao cadastro (laço de redirecionamento)", () => {
    expect(caminhoInternoSeguro("/login")).toBeNull();
    expect(caminhoInternoSeguro("/login?callbackUrl=%2Forgao")).toBeNull();
    expect(caminhoInternoSeguro("/cadastro?tipo=orgao")).toBeNull();
    expect(caminhoInternoSeguro("/loginx")).toBe("/loginx");
  });
});

describe("destinoPosLogin", () => {
  it("o órgão (com 2FA) entra em /orgao e os demais em /painel", () => {
    expect(destinoPosLogin("ORGAO", undefined, true)).toBe("/orgao");
    expect(destinoPosLogin("CIDADAO", undefined, false)).toBe("/painel");
    expect(destinoPosLogin("ADMIN", null, false)).toBe("/painel");
    expect(destinoPosLogin(undefined, null, false)).toBe("/painel");
  });

  it("o caminho pedido vence o destino padrão, para qualquer papel", () => {
    expect(destinoPosLogin("ORGAO", "/reclamacoes/RC-1", true)).toBe("/reclamacoes/RC-1");
    expect(destinoPosLogin("CIDADAO", "/transparencia", false)).toBe("/transparencia");
  });

  it("um caminho inseguro cai no destino padrão em vez de redirecionar", () => {
    expect(destinoPosLogin("ORGAO", "https://golpe.com", true)).toBe("/orgao");
    expect(destinoPosLogin("CIDADAO", "//golpe.com", false)).toBe("/painel");
  });

  it("o órgão sem 2FA vai ativá-lo em vez de ao painel, mesmo se o painel foi o caminho pedido", () => {
    expect(destinoPosLogin("ORGAO", undefined, false)).toBe("/painel/conta#seguranca");
    expect(destinoPosLogin("ORGAO", "/orgao?fila=acompanhamento", false)).toBe(
      "/painel/conta#seguranca"
    );
  });

  it("o desvio vale só para o painel do órgão: um caminho público pedido continua valendo", () => {
    expect(destinoPosLogin("ORGAO", "/transparencia", false)).toBe("/transparencia");
  });

  it("quem não é obrigado a ter o 2FA nunca é desviado", () => {
    expect(destinoPosLogin("CIDADAO", "/orgao", false)).toBe("/orgao");
    expect(destinoPosLogin("ADMIN", undefined, false)).toBe("/painel");
  });
});
