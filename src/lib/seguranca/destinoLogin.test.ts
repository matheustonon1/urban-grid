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
  it("o órgão entra em /orgao e os demais em /painel", () => {
    expect(destinoPosLogin("ORGAO", undefined)).toBe("/orgao");
    expect(destinoPosLogin("CIDADAO", undefined)).toBe("/painel");
    expect(destinoPosLogin("ADMIN", null)).toBe("/painel");
    expect(destinoPosLogin(undefined, null)).toBe("/painel");
  });

  it("o caminho pedido vence o destino padrão, para qualquer papel", () => {
    expect(destinoPosLogin("ORGAO", "/reclamacoes/RC-1")).toBe("/reclamacoes/RC-1");
    expect(destinoPosLogin("CIDADAO", "/transparencia")).toBe("/transparencia");
  });

  it("um caminho inseguro cai no destino padrão em vez de redirecionar", () => {
    expect(destinoPosLogin("ORGAO", "https://golpe.com")).toBe("/orgao");
    expect(destinoPosLogin("CIDADAO", "//golpe.com")).toBe("/painel");
  });
});
