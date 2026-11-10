import { describe, expect, it } from "vitest";

import {
  descreverFalha,
  ehErroTemporario,
  ehFalhaDaIA,
  esperaAntesDaProximaTentativa,
  registroDeFalha,
  SCORE_DE_FALHA,
  TENTATIVAS_DA_IA,
} from "./falha";

// Erro como o ApiError do SDK do Gemini: `status` HTTP e a mensagem é o JSON de erro da API.
function erroDaApi(status: number, situacao = "UNAVAILABLE") {
  return Object.assign(
    new Error(JSON.stringify({ error: { code: status, message: "This model is busy.", status: situacao } })),
    { name: "ApiError", status }
  );
}

describe("ehErroTemporario", () => {
  it("repete o que pode passar sozinho: modelo sobrecarregado, fora do ar ou lento", () => {
    for (const status of [408, 500, 502, 503, 504]) {
      expect(ehErroTemporario(erroDaApi(status))).toBe(true);
    }
  });

  it("não repete o que repetir não resolve: pedido, chave ou modelo errados", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(ehErroTemporario(erroDaApi(status, "INVALID"))).toBe(false);
    }
  });

  it("não repete 429: cota e limite por minuto não liberam em poucos segundos", () => {
    expect(ehErroTemporario(erroDaApi(429, "RESOURCE_EXHAUSTED"))).toBe(false);
  });

  it("falha de rede (a exceção não traz status HTTP) é temporária", () => {
    const rede = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
    });
    expect(ehErroTemporario(rede)).toBe(true);
  });
});

describe("esperaAntesDaProximaTentativa", () => {
  it("dobra a cada tentativa: 1 s, 2 s, 4 s (sem variação)", () => {
    expect(esperaAntesDaProximaTentativa(1, () => 0)).toBe(1000);
    expect(esperaAntesDaProximaTentativa(2, () => 0)).toBe(2000);
    expect(esperaAntesDaProximaTentativa(3, () => 0)).toBe(4000);
  });

  it("acrescenta no máximo 25% de variação", () => {
    expect(esperaAntesDaProximaTentativa(1, () => 1)).toBe(1250);
    expect(esperaAntesDaProximaTentativa(3, () => 1)).toBe(5000);
  });

  it("a soma das esperas cabe em ~9 s com a variação no máximo: quem envia não espera à toa", () => {
    const total = Array.from({ length: TENTATIVAS_DA_IA - 1 }, (_, i) =>
      esperaAntesDaProximaTentativa(i + 1, () => 1)
    ).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(9000);
  });
});

describe("descreverFalha", () => {
  it("erro da API vira o código HTTP e a situação, sem a mensagem toda", () => {
    expect(descreverFalha(erroDaApi(503))).toBe("HTTP 503 UNAVAILABLE");
  });

  it("erro da API com mensagem que não é JSON fica só com o código HTTP", () => {
    const erro = Object.assign(new Error("Bad Gateway"), { status: 502 });
    expect(descreverFalha(erro)).toBe("HTTP 502");
  });

  it("falha de rede mostra o nome, o código e a mensagem", () => {
    const rede = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "UND_ERR_CONNECT_TIMEOUT" },
    });
    expect(descreverFalha(rede)).toBe("TypeError (UND_ERR_CONNECT_TIMEOUT): fetch failed");
  });

  it("limita o tamanho e aceita o que não é Error", () => {
    expect(descreverFalha(new Error("x".repeat(1000))).length).toBeLessThanOrEqual(200);
    expect(descreverFalha("texto solto")).toContain("texto solto");
    expect(descreverFalha(null)).toBeTypeOf("string");
  });
});

describe("registro de falha: o que se grava é o que as telas reconhecem", () => {
  it("o registro gravado pela falha é reconhecido por ehFalhaDaIA (nenhum eixo preenchido)", () => {
    const registro = registroDeFalha(erroDaApi(503));
    expect(registro.scoreGeral).toBe(SCORE_DE_FALHA);
    // Quem grava (moderarReclamacao/moderarComentario) não preenche eixo nenhum.
    expect(ehFalhaDaIA({ scoreGeral: registro.scoreGeral, scoreOfensivo: null })).toBe(true);
  });

  it("guarda o motivo em resultadoJson, como JSON válido", () => {
    const { resultadoJson } = registroDeFalha(erroDaApi(503));
    expect(JSON.parse(resultadoJson)).toEqual({ falha: "HTTP 503 UNAVAILABLE" });
  });

  it("uma análise de verdade nunca é tomada por falha, mesmo com nota 1", () => {
    // IA que reprovou com a nota máxima: tem eixo preenchido.
    expect(ehFalhaDaIA({ scoreGeral: 1, scoreOfensivo: 1 })).toBe(false);
    expect(ehFalhaDaIA({ scoreGeral: 1, scoreOfensivo: 0 })).toBe(false);
    expect(ehFalhaDaIA({ scoreGeral: 0.3, scoreOfensivo: 0.3 })).toBe(false);
  });

  it("registro antigo sem eixos mas com outra nota é só um registro sem detalhe, não falha", () => {
    expect(ehFalhaDaIA({ scoreGeral: 0.3, scoreOfensivo: null })).toBe(false);
  });
});
