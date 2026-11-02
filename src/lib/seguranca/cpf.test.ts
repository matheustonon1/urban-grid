import { describe, expect, it } from "vitest";

import { formatarCpf, hashCpf, normalizarCpf, validarCpf } from "./cpf";

describe("validarCpf", () => {
  it("aceita um CPF válido conhecido", () => {
    expect(validarCpf("111.444.777-35")).toBe(true);
  });

  it("aceita o mesmo CPF só com dígitos", () => {
    expect(validarCpf("11144477735")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarCpf("111.444.777-36")).toBe(false);
  });

  it("rejeita sequência repetida", () => {
    expect(validarCpf("000.000.000-00")).toBe(false);
    expect(validarCpf("111.111.111-11")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(validarCpf("123.456.789-0")).toBe(false);
    expect(validarCpf("")).toBe(false);
  });
});

describe("normalizarCpf", () => {
  it("remove tudo que não é dígito", () => {
    expect(normalizarCpf("111.444.777-35")).toBe("11144477735");
  });
});

describe("formatarCpf", () => {
  it("formata um CPF só com dígitos", () => {
    expect(formatarCpf("11144477735")).toBe("111.444.777-35");
  });

  it("devolve o valor original se não tiver 11 dígitos", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("hashCpf", () => {
  it("é determinístico para o mesmo CPF, formatado ou não", () => {
    expect(hashCpf("111.444.777-35")).toBe(hashCpf("11144477735"));
  });

  it("gera hashes diferentes para CPFs diferentes", () => {
    expect(hashCpf("111.444.777-35")).not.toBe(hashCpf("529.982.247-25"));
  });
});
