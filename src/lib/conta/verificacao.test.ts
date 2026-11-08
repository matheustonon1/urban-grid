import { describe, expect, it } from "vitest";

import { destinoPosCadastro, PARAM_EMAIL_NAO_ENVIADO, precisaVerificarEmail } from "./verificacao";

describe("destinoPosCadastro", () => {
  it("vai direto ao painel quando o e-mail de verificação saiu", () => {
    expect(destinoPosCadastro({ status: "enviado" })).toBe("/painel");
  });

  it("não alarma em dev/CI, onde o envio é simulado de propósito", () => {
    expect(destinoPosCadastro({ status: "simulado" })).toBe("/painel");
  });

  it("leva o aviso junto quando o provedor recusou o e-mail", () => {
    expect(destinoPosCadastro({ status: "falhou" })).toBe(`/painel?email=${PARAM_EMAIL_NAO_ENVIADO}`);
  });
});

describe("precisaVerificarEmail", () => {
  it("exige verificação pra conta criada depois do corte, sem e-mail verificado", () => {
    expect(
      precisaVerificarEmail({ createdAt: new Date("2026-09-11T00:00:00Z"), emailVerified: null })
    ).toBe(true);
  });

  it("não exige se o e-mail já foi verificado", () => {
    expect(
      precisaVerificarEmail({
        createdAt: new Date("2026-09-11T00:00:00Z"),
        emailVerified: new Date("2026-09-12T00:00:00Z"),
      })
    ).toBe(false);
  });

  it("isenta contas criadas antes do corte, mesmo sem e-mail verificado", () => {
    expect(
      precisaVerificarEmail({ createdAt: new Date("2026-09-01T00:00:00Z"), emailVerified: null })
    ).toBe(false);
  });

  it("trata a data de corte como inclusiva", () => {
    expect(
      precisaVerificarEmail({ createdAt: new Date("2026-09-10T00:00:00Z"), emailVerified: null })
    ).toBe(true);
  });
});
