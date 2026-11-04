import { describe, expect, it } from "vitest";

import { cnpjValido, formatarCnpj, normalizarCnpj } from "./cnpj";

describe("normalizarCnpj", () => {
  it("tira a máscara e põe as letras em maiúsculas", () => {
    expect(normalizarCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizarCnpj(" 12.abc.345/01de-35 ")).toBe("12ABC34501DE35");
  });
});

describe("cnpjValido", () => {
  it("aceita CNPJ numérico, com ou sem máscara", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("aceita CNPJ alfanumérico (exemplo oficial da Receita)", () => {
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12abc34501de35")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("11.222.333/0001-91")).toBe(false);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
  });

  it("recusa tamanho errado, letra nos dígitos verificadores e caractere fora de A-Z/0-9", () => {
    expect(cnpjValido("1122233300018")).toBe(false);
    expect(cnpjValido("112223330001811")).toBe(false);
    expect(cnpjValido("12ABC34501DEAB")).toBe(false);
    expect(cnpjValido("12.ABC.345/01D!-35")).toBe(false);
    expect(cnpjValido("")).toBe(false);
  });

  it("recusa sequência de caracteres iguais, que passa na conta", () => {
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });
});

describe("formatarCnpj", () => {
  it("aplica a máscara do CNPJ", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });

  it("devolve como veio o que não tem 14 caracteres", () => {
    expect(formatarCnpj("123")).toBe("123");
  });
});
