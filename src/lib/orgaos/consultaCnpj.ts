import * as z from "zod";

import { cnpjValido, normalizarCnpj } from "./cnpj";

// Consulta o cadastro público do CNPJ (BrasilAPI, que serve os dados abertos da Receita Federal)
// para o ADMIN conferir um pedido de acesso: razão social, situação cadastral e natureza
// jurídica. É um indício a mais, não uma decisão: o resultado não é guardado e a aprovação nunca
// depende dele (o serviço pode estar fora do ar, e um CNPJ alfanumérico novo pode ainda não
// constar da base). O CNPJ de pessoa jurídica é dado público, não pessoal.
//
// Só o servidor chama, a partir de uma action de admin, e a URL é fixa com o CNPJ (14 caracteres
// [0-9A-Z] já validados) no caminho: nada vindo do formulário escolhe o endereço consultado.

const URL_BASE = "https://brasilapi.com.br/api/cnpj/v1";
const TEMPO_LIMITE_MS = 8000;

// Só o que a tela usa. A resposta vem de fora, então é validada, não confiada.
const respostaSchema = z.object({
  razao_social: z.string().min(1),
  nome_fantasia: z.string().nullish(),
  descricao_situacao_cadastral: z.string().min(1),
  codigo_natureza_juridica: z.union([z.number(), z.string()]),
  natureza_juridica: z.string().min(1),
  municipio: z.string().nullish(),
  uf: z.string().nullish(),
});

export interface DadosCnpj {
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string;
  situacaoAtiva: boolean;
  naturezaJuridica: string;
  // Na tabela de naturezas jurídicas, o grupo 1 é a Administração Pública (órgão público,
  // autarquia, fundação pública, município...). Um CNPJ de empresa privada cai fora dele.
  administracaoPublica: boolean;
  municipio: string | null;
  uf: string | null;
}

export type ResultadoConsultaCnpj =
  | { ok: true; dados: DadosCnpj }
  | { ok: false; motivo: "naoEncontrado" | "indisponivel" };

export async function consultarCnpj(
  cnpjInformado: string,
  buscar: typeof fetch = fetch
): Promise<ResultadoConsultaCnpj> {
  const cnpj = normalizarCnpj(cnpjInformado);
  if (!cnpjValido(cnpj)) return { ok: false, motivo: "naoEncontrado" };

  let resposta: Response;
  try {
    resposta = await buscar(`${URL_BASE}/${cnpj}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      cache: "no-store",
    });
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }

  if (resposta.status === 404) return { ok: false, motivo: "naoEncontrado" };
  if (!resposta.ok) return { ok: false, motivo: "indisponivel" };

  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }

  const validado = respostaSchema.safeParse(corpo);
  if (!validado.success) return { ok: false, motivo: "indisponivel" };

  const dados = validado.data;
  return {
    ok: true,
    dados: {
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia?.trim() || null,
      situacao: dados.descricao_situacao_cadastral,
      situacaoAtiva: dados.descricao_situacao_cadastral.trim().toUpperCase() === "ATIVA",
      naturezaJuridica: dados.natureza_juridica,
      administracaoPublica: String(dados.codigo_natureza_juridica).startsWith("1"),
      municipio: dados.municipio?.trim() || null,
      uf: dados.uf?.trim() || null,
    },
  };
}
