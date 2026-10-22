// Cortes da moderação por IA, numa fonte só. decidir() (lib/moderacao) e todas
// as telas que colorem uma pontuação (PontuacoesIA, estatísticas) usam estes
// valores - quando eram constantes soltas em cada arquivo, uma mudança no
// pipeline deixaria as telas mostrando "alerta" num corte que já não vale.
export const LIMITE_REVISAO = 0.4;
export const LIMITE_REPROVACAO = 0.75;

// Comentários têm uma moderação mais leve (3 eixos, decisão binária): reprovam
// a partir daqui, sem faixa de "revisão" no meio.
export const LIMITE_REPROVACAO_COMENTARIO = 0.5;

export type NivelPontuacao = "ok" | "atencao" | "alto";

// `invertido`: coerência texto/imagem é o contrário dos outros eixos (quanto
// MAIOR, melhor); nela o risco é 1 - valor.
export function nivelPontuacao(valor: number, invertido = false): NivelPontuacao {
  const risco = invertido ? 1 - valor : valor;
  if (risco >= LIMITE_REPROVACAO) return "alto";
  if (risco >= LIMITE_REVISAO) return "atencao";
  return "ok";
}
