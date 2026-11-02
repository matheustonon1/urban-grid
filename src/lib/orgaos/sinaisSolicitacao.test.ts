import { describe, expect, it } from "vitest";

import { classificarDominioEmail, sinaisDaSolicitacao } from "./sinaisSolicitacao";

describe("classificarDominioEmail", () => {
  it.each([
    ["obras@prefeitura.sp.gov.br", "institucional", "prefeitura.sp.gov.br"],
    ["gabinete@camara.leg.br", "institucional", "camara.leg.br"],
    ["JOAO@Prefeitura.MG.GOV.BR", "institucional", "prefeitura.mg.gov.br"],
    ["fulano@gmail.com", "pessoal", "gmail.com"],
    ["fulano@HOTMAIL.com", "pessoal", "hotmail.com"],
    ["obras@prefeituradeitu.com.br", "proprio", "prefeituradeitu.com.br"],
  ])("%s é %s", (email, tipo, dominio) => {
    expect(classificarDominioEmail(email)).toEqual({ tipo, dominio });
  });

  it("não se deixa enganar por um sufixo parecido no meio do domínio", () => {
    // O domínio é "gov.br.golpe.com", não um domínio de governo.
    expect(classificarDominioEmail("a@gov.br.golpe.com").tipo).toBe("proprio");
    expect(classificarDominioEmail("a@notgov.br").tipo).toBe("proprio");
  });

  it("usa o que vem depois da última arroba", () => {
    expect(classificarDominioEmail("a@gmail.com@x.gov.br").tipo).toBe("institucional");
  });
});

describe("sinaisDaSolicitacao", () => {
  it("e-mail institucional, órgão novo e sem histórico: só o sinal do domínio, em tom positivo", () => {
    expect(
      sinaisDaSolicitacao({
        email: "obras@prefeitura.sp.gov.br",
        responsaveisDoOrgaoExistente: null,
        rejeicoesAnteriores: 0,
      })
    ).toEqual([{ chave: "dominioInstitucional", tom: "sucesso", dominio: "prefeitura.sp.gov.br" }]);
  });

  it("órgão que já existe vem primeiro e diz quantos responsáveis ele já tem", () => {
    const sinais = sinaisDaSolicitacao({
      email: "novo@gmail.com",
      responsaveisDoOrgaoExistente: 2,
      rejeicoesAnteriores: 0,
    });
    expect(sinais.map((sinal) => sinal.chave)).toEqual(["orgaoJaExiste", "dominioPessoal"]);
    expect(sinais[0]).toMatchObject({ count: 2, tom: "atencao" });
  });

  it("órgão existente sem responsáveis (convite nunca aceito) ainda é um sinal", () => {
    const sinais = sinaisDaSolicitacao({
      email: "a@x.com.br",
      responsaveisDoOrgaoExistente: 0,
      rejeicoesAnteriores: 0,
    });
    expect(sinais[0]).toMatchObject({ chave: "orgaoJaExiste", count: 0 });
  });

  it("e-mail pessoal com pedido já rejeitado acumula os dois avisos", () => {
    const sinais = sinaisDaSolicitacao({
      email: "fulano@gmail.com",
      responsaveisDoOrgaoExistente: null,
      rejeicoesAnteriores: 3,
    });
    expect(sinais.map((sinal) => sinal.chave)).toEqual(["dominioPessoal", "jaRejeitada"]);
    expect(sinais[1]).toMatchObject({ count: 3 });
  });

  it("domínio próprio fica neutro: pede conferência, não alarma", () => {
    const [sinal] = sinaisDaSolicitacao({
      email: "obras@prefeituradeitu.com.br",
      responsaveisDoOrgaoExistente: null,
      rejeicoesAnteriores: 0,
    });
    expect(sinal).toMatchObject({ chave: "dominioProprio", tom: "neutro" });
  });
});
