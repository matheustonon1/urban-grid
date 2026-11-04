import type { DadosCnpj } from "@/lib/orgaos/consultaCnpj";

export { criarMotivoRejeicaoSchema as criarRejeitarSolicitacaoSchema } from "@/lib/moderacao/motivoRejeicao";

// Resposta da consulta do CNPJ de um pedido: os dados (não guardados) ou o motivo de não haver.
export type ConsultaCnpjState =
  | undefined
  | { ok: true; dados: DadosCnpj }
  | { ok: false; motivo: "naoEncontrado" | "indisponivel" | "semCnpj" | "limite" };
