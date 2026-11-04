import { describe, expect, it, vi } from "vitest";

import { consultarCnpj } from "./consultaCnpj";

const CNPJ = "11.222.333/0001-81";

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status });
}

const PREFEITURA = {
  razao_social: "MUNICIPIO DE SAO LUCAS",
  nome_fantasia: "PREFEITURA MUNICIPAL DE SAO LUCAS",
  descricao_situacao_cadastral: "ATIVA",
  codigo_natureza_juridica: 1244,
  natureza_juridica: "Município",
  municipio: "SAO LUCAS",
  uf: "SP",
};

describe("consultarCnpj", () => {
  it("devolve os dados que a tela usa e marca a administração pública pelo código da natureza", async () => {
    const buscar = vi.fn().mockResolvedValue(respostaJson(PREFEITURA));

    const resultado = await consultarCnpj(CNPJ, buscar);

    expect(resultado).toEqual({
      ok: true,
      dados: {
        razaoSocial: "MUNICIPIO DE SAO LUCAS",
        nomeFantasia: "PREFEITURA MUNICIPAL DE SAO LUCAS",
        situacao: "ATIVA",
        situacaoAtiva: true,
        naturezaJuridica: "Município",
        administracaoPublica: true,
        municipio: "SAO LUCAS",
        uf: "SP",
      },
    });
  });

  it("consulta só o endereço fixo, com o CNPJ normalizado no caminho", async () => {
    const buscar = vi.fn().mockResolvedValue(respostaJson(PREFEITURA));

    await consultarCnpj(CNPJ, buscar);

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar.mock.calls[0][0]).toBe("https://brasilapi.com.br/api/cnpj/v1/11222333000181");
  });

  it("empresa privada cai fora da administração pública e situação baixada não é ativa", async () => {
    const buscar = vi.fn().mockResolvedValue(
      respostaJson({
        ...PREFEITURA,
        descricao_situacao_cadastral: "BAIXADA",
        codigo_natureza_juridica: "2062",
        natureza_juridica: "Sociedade Empresária Limitada",
      })
    );

    const resultado = await consultarCnpj(CNPJ, buscar);

    expect(resultado.ok && resultado.dados.administracaoPublica).toBe(false);
    expect(resultado.ok && resultado.dados.situacaoAtiva).toBe(false);
  });

  it("nome fantasia vazio ou ausente vira null", async () => {
    const buscar = vi
      .fn()
      .mockResolvedValue(respostaJson({ ...PREFEITURA, nome_fantasia: "  ", municipio: null }));

    const resultado = await consultarCnpj(CNPJ, buscar);

    expect(resultado.ok && resultado.dados.nomeFantasia).toBeNull();
    expect(resultado.ok && resultado.dados.municipio).toBeNull();
  });

  it("CNPJ inválido nem chega à rede", async () => {
    const buscar = vi.fn();

    expect(await consultarCnpj("11.222.333/0001-82", buscar)).toEqual({
      ok: false,
      motivo: "naoEncontrado",
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("404 é 'não encontrado'; outro erro do serviço, rede e tempo esgotado são 'indisponível'", async () => {
    expect(await consultarCnpj(CNPJ, vi.fn().mockResolvedValue(respostaJson({}, 404)))).toEqual({
      ok: false,
      motivo: "naoEncontrado",
    });
    expect(await consultarCnpj(CNPJ, vi.fn().mockResolvedValue(respostaJson({}, 500)))).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
    expect(await consultarCnpj(CNPJ, vi.fn().mockRejectedValue(new Error("rede")))).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
  });

  it("resposta fora do formato esperado não é confiada: vira 'indisponível'", async () => {
    const semRazao = { ...PREFEITURA, razao_social: undefined };

    expect(await consultarCnpj(CNPJ, vi.fn().mockResolvedValue(respostaJson(semRazao)))).toEqual({
      ok: false,
      motivo: "indisponivel",
    });
    expect(
      await consultarCnpj(CNPJ, vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })))
    ).toEqual({ ok: false, motivo: "indisponivel" });
  });
});
