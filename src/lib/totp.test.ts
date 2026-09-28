import { describe, expect, it } from "vitest";
import { generate } from "otplib";

import {
  cifrarSegredoTotp,
  codigoTotpValido,
  decifrarSegredoTotp,
  gerarCodigosBackup,
  gerarSegredoTotp,
  gerarUriTotp,
} from "./totp";

describe("cifrarSegredoTotp / decifrarSegredoTotp", () => {
  it("recupera o segredo original depois de cifrar", () => {
    const segredo = gerarSegredoTotp();
    expect(decifrarSegredoTotp(cifrarSegredoTotp(segredo))).toBe(segredo);
  });

  it("gera saídas diferentes pro mesmo segredo (IV aleatório)", () => {
    const segredo = gerarSegredoTotp();
    expect(cifrarSegredoTotp(segredo)).not.toBe(cifrarSegredoTotp(segredo));
  });
});

describe("gerarUriTotp", () => {
  it("inclui o e-mail e o emissor na URI", () => {
    const uri = gerarUriTotp("usuario@example.com", "SEGREDO123");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(encodeURIComponent("usuario@example.com"));
    expect(uri).toContain("Urban%20Grid");
  });
});

describe("codigoTotpValido", () => {
  it("aceita um código gerado com o segredo correto e retorna o timeStep", async () => {
    const segredo = gerarSegredoTotp();
    const codigo = await generate({ secret: segredo });
    const resultado = await codigoTotpValido(segredo, codigo);
    expect(resultado.valido).toBe(true);
    expect(resultado.timeStep).toEqual(expect.any(Number));
  });

  it("rejeita um código incorreto", async () => {
    const segredo = gerarSegredoTotp();
    const codigoValido = await generate({ secret: segredo });
    const codigoErrado = ((Number(codigoValido) + 1) % 1_000_000)
      .toString()
      .padStart(6, "0");

    expect((await codigoTotpValido(segredo, codigoErrado)).valido).toBe(false);
  });

  it("rejeita um código gerado com outro segredo", async () => {
    const segredoA = gerarSegredoTotp();
    const segredoB = gerarSegredoTotp();
    const codigoDeB = await generate({ secret: segredoB });

    expect((await codigoTotpValido(segredoA, codigoDeB)).valido).toBe(false);
  });

  // Cenário do bug corrigido: sem afterTimeStep, o mesmo código continuava
  // valendo durante toda a janela de tolerância - qualquer um que o
  // tivesse visto uma vez (print, log, malware no autenticador) podia
  // reusá-lo pra logar de novo.
  it("rejeita um código já usado (mesmo timeStep) quando o último usado é informado", async () => {
    const segredo = gerarSegredoTotp();
    const codigo = await generate({ secret: segredo });

    const primeiraVez = await codigoTotpValido(segredo, codigo);
    expect(primeiraVez.valido).toBe(true);

    const reuso = await codigoTotpValido(segredo, codigo, primeiraVez.timeStep);
    expect(reuso.valido).toBe(false);
  });

  it("aceita um código novo mesmo com um timeStep anterior já registrado", async () => {
    const segredo = gerarSegredoTotp();
    const codigo = await generate({ secret: segredo });
    const primeiraVez = await codigoTotpValido(segredo, codigo);

    // Um timeStep bem anterior ao atual não deveria bloquear o código de
    // agora - só o mesmo timeStep (ou um posterior a ele) é que é rejeitado.
    const resultado = await codigoTotpValido(segredo, codigo, primeiraVez.timeStep! - 100);
    expect(resultado.valido).toBe(true);
  });
});

describe("gerarCodigosBackup", () => {
  it("gera 8 códigos únicos", () => {
    const codigos = gerarCodigosBackup();
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
  });
});
