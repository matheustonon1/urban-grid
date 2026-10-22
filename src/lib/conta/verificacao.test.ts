import { describe, expect, it } from "vitest";

import { precisaVerificarEmail } from "./verificacao";

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
