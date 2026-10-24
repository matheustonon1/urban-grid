import { describe, expect, it } from "vitest";

import {
  AMOSTRA_MINIMA,
  consumoDoModelo,
  disparosPorEixo,
  ehFalhaDaIA,
  escolherGranularidade,
  histogramaScore,
  idadesDaFila,
  interpretarPeriodo,
  maximoLegivel,
  motivosDeRevisao,
  percentil,
  porVersaoDoPrompt,
  resumirDecisoes,
  resumirDenuncias,
  revisaoHumana,
  variacaoPontos,
  variacaoRelativa,
  volumePorPeriodo,
  type LogEstatistica,
} from "./estatisticas";

function log(parcial: Partial<LogEstatistica> = {}): LogEstatistica {
  return {
    alvoTipo: "RECLAMACAO",
    decisao: "APROVAR",
    scoreGeral: 0.1,
    scoreOfensivo: 0.1,
    scoreSpam: 0.1,
    scoreDadosPessoais: 0.1,
    scoreForaEscopo: 0.1,
    scoreDesinformacao: 0.1,
    coerenciaTextoImagem: 0.9,
    versaoPrompt: "v2",
    latenciaMs: 1000,
    tokensEntrada: 100,
    tokensSaida: 20,
    decisaoFinal: null,
    revisadoEm: null,
    createdAt: new Date("2026-10-10T12:00:00Z"),
    ...parcial,
  };
}

// Log de falha do pipeline: nenhum eixo preenchido, scoreGeral 1.
const falha = (parcial: Partial<LogEstatistica> = {}) =>
  log({
    decisao: "ENCAMINHAR_REVISAO",
    scoreGeral: 1,
    scoreOfensivo: null,
    scoreSpam: null,
    scoreDadosPessoais: null,
    scoreForaEscopo: null,
    scoreDesinformacao: null,
    coerenciaTextoImagem: null,
    latenciaMs: 50,
    tokensEntrada: null,
    tokensSaida: null,
    ...parcial,
  });

describe("percentil", () => {
  it("devolve null sem dados", () => {
    expect(percentil([], 0.5)).toBeNull();
  });
  it("interpola entre vizinhos e ignora a ordem de entrada", () => {
    expect(percentil([40, 10, 30, 20], 0.5)).toBe(25);
    expect(percentil([10, 20, 30, 40], 0)).toBe(10);
    expect(percentil([10, 20, 30, 40], 1)).toBe(40);
  });
  it("p95 de 1..100 fica entre 95 e 96", () => {
    const valores = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentil(valores, 0.95)).toBeCloseTo(95.05, 5);
  });
  it("não altera a lista recebida", () => {
    const valores = [3, 1, 2];
    percentil(valores, 0.5);
    expect(valores).toEqual([3, 1, 2]);
  });
});

describe("variações", () => {
  it("relativa: 120 vs 100 = +20%; sem base = null", () => {
    expect(variacaoRelativa(120, 100)).toBe(20);
    expect(variacaoRelativa(80, 100)).toBe(-20);
    expect(variacaoRelativa(5, 0)).toBeNull();
    expect(variacaoRelativa(null, 10)).toBeNull();
  });
  it("em pontos: diferença de taxas em pontos percentuais", () => {
    expect(variacaoPontos(0.6, 0.5)).toBeCloseTo(10, 10);
    expect(variacaoPontos(null, 0.5)).toBeNull();
  });
});

describe("interpretarPeriodo", () => {
  it("aceita os períodos conhecidos e cai em 30 dias no resto", () => {
    expect(interpretarPeriodo("7").dias).toBe(7);
    expect(interpretarPeriodo("90").dias).toBe(90);
    expect(interpretarPeriodo("todos").dias).toBeNull();
    expect(interpretarPeriodo(undefined).chave).toBe("30");
    expect(interpretarPeriodo("abc").chave).toBe("30");
    expect(interpretarPeriodo(["7", "90"]).chave).toBe("7");
  });
});

describe("resumirDecisoes", () => {
  it("falhas da IA saem das taxas e viram contagem própria", () => {
    const resumo = resumirDecisoes([
      log({ decisao: "APROVAR" }),
      log({ decisao: "APROVAR" }),
      log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.5 }),
      log({ decisao: "REPROVAR", scoreGeral: 0.9 }),
      falha(),
    ]);
    expect(resumo).toMatchObject({ total: 5, validas: 4, falhas: 1, aprovar: 2, encaminhar: 1, reprovar: 1 });
    expect(resumo.taxaAprovar).toBe(0.5);
    expect(resumo.taxaEncaminhar).toBe(0.25);
  });
  it("sem análises: taxas nulas, não NaN", () => {
    const resumo = resumirDecisoes([]);
    expect(resumo.taxaAprovar).toBeNull();
    expect(resumo.total).toBe(0);
  });
  it("ehFalhaDaIA: nenhum eixo preenchido E scoreGeral 1 (o que o pipeline grava)", () => {
    expect(ehFalhaDaIA(falha())).toBe(true);
    expect(ehFalhaDaIA(log())).toBe(false);
    // Registro antigo sem eixos, mas com outro score: não é falha.
    expect(ehFalhaDaIA(falha({ scoreGeral: 0.3 }))).toBe(false);
  });
});

describe("motivosDeRevisao", () => {
  it("separa pontuação, repostagem (revisão com score baixo) e falha", () => {
    const motivos = motivosDeRevisao([
      log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.55 }),
      log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.4 }),
      log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.2 }),
      falha(),
      log({ decisao: "APROVAR" }),
      log({ alvoTipo: "COMENTARIO", decisao: "REPROVAR", scoreGeral: 0.8 }),
    ]);
    expect(motivos).toEqual({ porPontuacao: 2, porRepostagem: 1, porFalha: 1 });
  });
});

describe("histogramaScore", () => {
  it("20 faixas de 0,05 e zonas alinhadas aos cortes 0,4 e 0,75", () => {
    const faixas = histogramaScore([]);
    expect(faixas).toHaveLength(20);
    expect(faixas[7].zona).toBe("ok"); // 0,35-0,40
    expect(faixas[8].zona).toBe("atencao"); // 0,40-0,45
    expect(faixas[14].zona).toBe("atencao"); // 0,70-0,75
    expect(faixas[15].zona).toBe("alto"); // 0,75-0,80
  });
  it("score exatamente num corte cai na faixa que começa nele", () => {
    const faixas = histogramaScore([0.4, 0.75, 0.35, 0.05, 0]);
    expect(faixas[8].quantidade).toBe(1);
    expect(faixas[15].quantidade).toBe(1);
    expect(faixas[7].quantidade).toBe(1);
    expect(faixas[1].quantidade).toBe(1);
    expect(faixas[0].quantidade).toBe(1);
  });
  it("1,0 entra na última faixa; fora do intervalo é contido", () => {
    const faixas = histogramaScore([1, 1.3, -0.2]);
    expect(faixas[19].quantidade).toBe(2);
    expect(faixas[0].quantidade).toBe(1);
  });
  it("conserva o total", () => {
    const scores = Array.from({ length: 137 }, (_, i) => (i % 101) / 100);
    const total = histogramaScore(scores).reduce((soma, f) => soma + f.quantidade, 0);
    expect(total).toBe(137);
  });
});

describe("maximoLegivel", () => {
  it("é o dobro de um número redondo, nunca abaixo de 4", () => {
    expect(maximoLegivel(0)).toBe(4);
    expect(maximoLegivel(3)).toBe(4);
    expect(maximoLegivel(5)).toBe(6);
    expect(maximoLegivel(7)).toBe(8);
    expect(maximoLegivel(9)).toBe(10);
    expect(maximoLegivel(11)).toBe(12);
    expect(maximoLegivel(25)).toBe(30);
    expect(maximoLegivel(45)).toBe(50);
    expect(maximoLegivel(100)).toBe(100);
    expect(maximoLegivel(101)).toBe(120);
  });
  it("cobre o maior valor e a linha do meio é sempre inteira", () => {
    for (let n = 0; n <= 2000; n++) {
      const teto = maximoLegivel(n);
      expect(teto).toBeGreaterThanOrEqual(n);
      expect(Number.isInteger(teto / 2)).toBe(true);
    }
  });
  it("não deixa o gráfico mais de ~60% vazio", () => {
    for (let n = 8; n <= 2000; n++) expect(maximoLegivel(n) / n).toBeLessThan(1.7);
  });
});

describe("volumePorPeriodo", () => {
  const de = new Date("2026-10-08T00:00:00Z");
  const ate = new Date("2026-10-12T23:00:00Z");

  it("um bucket por dia, com zeros, e contagem por decisão", () => {
    const buckets = volumePorPeriodo(
      [
        log({ createdAt: new Date("2026-10-10T01:00:00Z"), decisao: "APROVAR" }),
        log({ createdAt: new Date("2026-10-10T23:59:00Z"), decisao: "REPROVAR", scoreGeral: 0.9 }),
        log({ createdAt: new Date("2026-10-12T10:00:00Z"), decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.5 }),
        falha({ createdAt: new Date("2026-10-12T11:00:00Z") }),
        log({ createdAt: new Date("2026-09-01T00:00:00Z") }), // fora da janela
      ],
      de,
      ate,
      "dia"
    );
    expect(buckets.map((b) => b.chave)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    expect(buckets.map((b) => b.total)).toEqual([0, 0, 2, 0, 2]);
    expect(buckets[2]).toMatchObject({ aprovar: 1, reprovar: 1 });
    expect(buckets[4]).toMatchObject({ encaminhar: 1, falhas: 1 });
  });

  it("semana começa na segunda-feira", () => {
    // 2026-10-12 é segunda-feira.
    const buckets = volumePorPeriodo(
      [
        log({ createdAt: new Date("2026-10-11T12:00:00Z") }), // domingo -> semana de 05/10
        log({ createdAt: new Date("2026-10-12T00:00:00Z") }), // segunda -> semana de 12/10
        log({ createdAt: new Date("2026-10-18T23:00:00Z") }), // domingo -> semana de 12/10
      ],
      new Date("2026-10-05T00:00:00Z"),
      new Date("2026-10-18T23:00:00Z"),
      "semana"
    );
    expect(buckets.map((b) => b.chave)).toEqual(["2026-10-05", "2026-10-12"]);
    expect(buckets.map((b) => b.total)).toEqual([1, 2]);
  });

  it("mês agrupa pelo dia 1", () => {
    const buckets = volumePorPeriodo(
      [log({ createdAt: new Date("2026-08-31T23:00:00Z") }), log({ createdAt: new Date("2026-10-01T00:00:00Z") })],
      new Date("2026-08-15T00:00:00Z"),
      new Date("2026-10-20T00:00:00Z"),
      "mes"
    );
    expect(buckets.map((b) => b.chave)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(buckets.map((b) => b.total)).toEqual([1, 0, 1]);
  });

  it("escolherGranularidade: dia, semana, mês conforme a janela", () => {
    expect(escolherGranularidade(7)).toBe("dia");
    expect(escolherGranularidade(30)).toBe("dia");
    expect(escolherGranularidade(90)).toBe("semana");
    expect(escolherGranularidade(400)).toBe("mes");
  });
});

describe("disparosPorEixo", () => {
  it("conta quantas análises passaram do corte em cada eixo, ordenado do que mais dispara", () => {
    const eixos = disparosPorEixo(
      [
        log({ scoreSpam: 0.8, scoreOfensivo: 0.1 }),
        log({ scoreSpam: 0.5, scoreOfensivo: 0.45 }),
        log({ scoreSpam: 0.1, scoreOfensivo: 0.1 }),
        falha(), // não entra: não é avaliação
      ],
      "RECLAMACAO",
      0.4
    );
    expect(eixos[0]).toMatchObject({ eixo: "spam", disparos: 2, amostra: 3 });
    expect(eixos[1]).toMatchObject({ eixo: "ofensivo", disparos: 1 });
    expect(eixos[0].taxa).toBeCloseTo(2 / 3, 10);
  });

  it("coerência texto/imagem é invertida (baixa = risco) e só conta quem tem foto", () => {
    const eixos = disparosPorEixo(
      [
        log({ coerenciaTextoImagem: 0.2 }), // risco 0,8
        log({ coerenciaTextoImagem: 0.9 }), // risco 0,1
        log({ coerenciaTextoImagem: null }), // sem foto
      ],
      "RECLAMACAO",
      0.4
    );
    const coerencia = eixos.find((e) => e.eixo === "coerenciaTextoImagem")!;
    expect(coerencia).toMatchObject({ amostra: 2, disparos: 1 });
    expect(coerencia.mediaRisco).toBeCloseTo(0.45, 10);
  });

  it("comentário só tem 3 eixos e outro tipo não entra", () => {
    const eixos = disparosPorEixo(
      [log({ alvoTipo: "COMENTARIO", scoreOfensivo: 0.9 }), log({ scoreOfensivo: 0.9 })],
      "COMENTARIO",
      0.5
    );
    expect(eixos.map((e) => e.eixo).sort()).toEqual(["dadosPessoais", "ofensivo", "spam"]);
    expect(eixos.find((e) => e.eixo === "ofensivo")).toMatchObject({ amostra: 1, disparos: 1 });
  });

  it("sem dados, taxa nula e não NaN", () => {
    const eixos = disparosPorEixo([], "RECLAMACAO", 0.4);
    expect(eixos.every((e) => e.taxa === null && e.mediaRisco === null)).toBe(true);
  });
});

describe("revisaoHumana", () => {
  const criado = new Date("2026-10-10T10:00:00Z");
  const horas = (h: number) => new Date(criado.getTime() + h * 3_600_000);

  it("reclamação: revisão encaminhada, aprovar/rejeitar é o fluxo normal", () => {
    const r = revisaoHumana(
      [
        log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.5, createdAt: criado, decisaoFinal: "APROVAR", revisadoEm: horas(2) }),
        log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.6, createdAt: criado, decisaoFinal: "REPROVAR", revisadoEm: horas(4) }),
        log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.6, createdAt: criado }),
        log({ decisao: "APROVAR" }), // nunca foi pra revisão
        log({ alvoTipo: "COMENTARIO", decisao: "REPROVAR", scoreGeral: 0.9 }),
      ],
      "RECLAMACAO"
    );
    expect(r).toMatchObject({
      paraRevisar: 3,
      revisadas: 2,
      pendentes: 1,
      aprovadasPorHumano: 1,
      rejeitadasPorHumano: 1,
      taxaAprovadaPorHumano: 0.5,
      amostraPequena: true,
    });
    expect(r.medianaMs).toBe(3 * 3_600_000);
  });

  it("comentário: a IA reprovou e o humano confirma ou reverte", () => {
    const r = revisaoHumana(
      [
        log({ alvoTipo: "COMENTARIO", decisao: "REPROVAR", scoreGeral: 0.9, decisaoFinal: "APROVAR", revisadoEm: horas(1) }),
        log({ alvoTipo: "COMENTARIO", decisao: "REPROVAR", scoreGeral: 0.9, decisaoFinal: "REPROVAR", revisadoEm: horas(1) }),
        log({ alvoTipo: "COMENTARIO", decisao: "APROVAR" }),
      ],
      "COMENTARIO"
    );
    expect(r.paraRevisar).toBe(2);
    expect(r.aprovadasPorHumano).toBe(1);
    expect(r.taxaAprovadaPorHumano).toBe(0.5);
  });

  it("amostra pequena some a partir de AMOSTRA_MINIMA revisões", () => {
    const muitos = Array.from({ length: AMOSTRA_MINIMA }, () =>
      log({ decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.5, decisaoFinal: "APROVAR", revisadoEm: horas(1), createdAt: criado })
    );
    expect(revisaoHumana(muitos, "RECLAMACAO").amostraPequena).toBe(false);
  });

  it("sem revisão, taxa e mediana nulas", () => {
    const r = revisaoHumana([], "RECLAMACAO");
    expect(r.taxaAprovadaPorHumano).toBeNull();
    expect(r.medianaMs).toBeNull();
  });
});

describe("porVersaoDoPrompt", () => {
  it("agrupa por tipo e versão, com taxas e a última vez em uso", () => {
    const linhas = porVersaoDoPrompt([
      log({ versaoPrompt: "v1", createdAt: new Date("2026-10-01T00:00:00Z") }),
      log({ versaoPrompt: "v2", createdAt: new Date("2026-10-05T00:00:00Z"), decisao: "ENCAMINHAR_REVISAO", scoreGeral: 0.5 }),
      log({ versaoPrompt: "v2", createdAt: new Date("2026-10-09T00:00:00Z") }),
      log({ alvoTipo: "COMENTARIO", versaoPrompt: "v1" }),
    ]);
    expect(linhas).toHaveLength(3);
    const v2 = linhas.find((l) => l.tipo === "RECLAMACAO" && l.versao === "v2")!;
    expect(v2.analises).toBe(2);
    expect(v2.taxaEncaminhar).toBe(0.5);
    expect(v2.ultimaVez.toISOString()).toBe("2026-10-09T00:00:00.000Z");
    // Comentários antes de reclamações (ordem alfabética do tipo), versão mais recente primeiro.
    expect(linhas[0].tipo).toBe("COMENTARIO");
    expect(linhas[1].versao).toBe("v2");
  });
});

describe("consumoDoModelo", () => {
  it("soma tokens e calcula latência sem contar as falhas", () => {
    const consumo = consumoDoModelo([
      log({ latenciaMs: 1000, tokensEntrada: 100, tokensSaida: 10 }),
      log({ latenciaMs: 3000, tokensEntrada: 300, tokensSaida: 30 }),
      falha({ latenciaMs: 99_999 }),
    ]);
    expect(consumo.tokensEntrada).toBe(400);
    expect(consumo.tokensSaida).toBe(40);
    expect(consumo.tokensPorAnalise).toBe(220);
    expect(consumo.latenciaP50Ms).toBe(2000);
    expect(consumo.latenciaMaxMs).toBe(3000);
  });
  it("sem dados, tudo nulo", () => {
    expect(consumoDoModelo([])).toMatchObject({ tokensPorAnalise: null, latenciaP50Ms: null, latenciaMaxMs: null });
  });
});

describe("idadesDaFila", () => {
  it("separa em até 24h, 24-72h e mais de 72h, com os mesmos cortes da fila", () => {
    const agora = new Date("2026-10-20T12:00:00Z");
    const atras = (h: number) => new Date(agora.getTime() - h * 3_600_000);
    const fila = idadesDaFila([atras(1), atras(23.9), atras(24), atras(71.9), atras(72), atras(200)], agora);
    expect(fila).toMatchObject({ total: 6, ate24h: 2, de24a72h: 2, mais72h: 2 });
    expect(fila.maisAntigaMs).toBe(200 * 3_600_000);
  });
  it("fila vazia", () => {
    expect(idadesDaFila([], new Date())).toMatchObject({ total: 0, maisAntigaMs: null });
  });
});

describe("resumirDenuncias", () => {
  it("conta por status, motivo e mede a mediana de resolução", () => {
    const criado = new Date("2026-10-10T00:00:00Z");
    const resumo = resumirDenuncias([
      { motivo: "SPAM", status: "PROCEDENTE", createdAt: criado, analisadoEm: new Date(criado.getTime() + 2 * 3_600_000) },
      { motivo: "SPAM", status: "IMPROCEDENTE", createdAt: criado, analisadoEm: new Date(criado.getTime() + 6 * 3_600_000) },
      { motivo: "OFENSIVO", status: "ABERTA", createdAt: criado, analisadoEm: null },
    ]);
    expect(resumo).toMatchObject({ total: 3, procedentes: 1, improcedentes: 1, emAberto: 1, taxaProcedente: 0.5 });
    expect(resumo.porMotivo[0]).toEqual({ motivo: "SPAM", quantidade: 2 });
    expect(resumo.medianaResolucaoMs).toBe(4 * 3_600_000);
  });
  it("sem denúncias resolvidas, taxa nula", () => {
    expect(resumirDenuncias([]).taxaProcedente).toBeNull();
  });
});
