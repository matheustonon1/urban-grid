// Falhas da IA de moderação, numa fonte só: o que vale tentar de novo, o que se grava quando a
// análise não sai, e como reconhecer esse registro depois. Quem ESCREVE o registro de falha
// (moderarReclamacao, moderarComentario) e quem o LÊ (telas de moderação, estatísticas) usam as
// mesmas definições daqui - antes cada lado tinha a sua cópia da regra "nota 1 e nenhum eixo", e
// as telas esqueciam dela e mostravam a falha como se fosse um veredito da IA.

// Chamadas ao modelo por análise (a primeira + as repetições). O modelo gratuito do Gemini devolve
// 503 ("high demand") com frequência, em rajadas de alguns segundos: com 1 falha a cada 3
// chamadas, três tentativas coladas esgotavam de vez em quando e a análise caía na fila humana.
export const TENTATIVAS_DA_IA = 4;
const ESPERA_BASE_MS = 1000;
const VARIACAO_MAXIMA = 0.25;

// Só repete o que pode passar sozinho em segundos: o servidor do modelo sobrecarregado ou
// fora do ar (500, 502, 503, 504), a requisição que estourou o tempo (408) e a falha de rede (a
// exceção não traz status HTTP). Fica de fora o que repetir não resolve:
// - 400/401/403/404: pedido, chave ou modelo errados. Repetir só adia o encaminhamento à fila.
// - 429: cota ou limite por minuto. Em segundos quase nunca libera, e a pessoa ficaria esperando
//   à toa dentro do envio da reclamação.
const STATUS_TEMPORARIOS = new Set([408, 500, 502, 503, 504]);

export function ehErroTemporario(erro: unknown): boolean {
  const status = (erro as { status?: unknown } | null)?.status;
  if (typeof status === "number") return STATUS_TEMPORARIOS.has(status);
  return true;
}

// Espera exponencial (1 s, 2 s, 4 s...) com até 25% de variação, para várias análises que
// falharam juntas não voltarem todas no mesmo instante. `tentativaQueFalhou` conta de 1.
export function esperaAntesDaProximaTentativa(
  tentativaQueFalhou: number,
  aleatorio: () => number = Math.random
): number {
  const base = ESPERA_BASE_MS * 2 ** (tentativaQueFalhou - 1);
  return Math.round(base * (1 + VARIACAO_MAXIMA * aleatorio()));
}

// Resumo curto e sem dado sensível do que deu errado, para o terminal e para o registro. O erro
// original só aparecia no console do servidor e se perdia quando ele reiniciava.
export function descreverFalha(erro: unknown): string {
  const e = erro as {
    name?: unknown;
    message?: unknown;
    status?: unknown;
    cause?: { code?: unknown };
  } | null;
  const mensagem = typeof e?.message === "string" ? e.message : String(erro);

  if (typeof e?.status === "number") {
    // ApiError do SDK: a mensagem é o JSON de erro da API ({"error":{"status":"UNAVAILABLE",...}}).
    try {
      const situacao = JSON.parse(mensagem)?.error?.status;
      if (typeof situacao === "string") return `HTTP ${e.status} ${situacao}`;
    } catch {
      /* a mensagem não é JSON: vale só o código HTTP */
    }
    return `HTTP ${e.status}`;
  }

  const nome = typeof e?.name === "string" ? e.name : "Erro";
  const codigo = typeof e?.cause?.code === "string" ? ` (${e.cause.code})` : "";
  return `${nome}${codigo}: ${mensagem}`.slice(0, 200);
}

// O que a análise que NÃO saiu grava em LogModeracao. A nota 1 é a do "lado seguro" (vai para
// revisão humana ou, em comentário, fica oculto); ela NÃO é uma avaliação do conteúdo, e por isso
// o registro não preenche nenhum eixo - é isso que ehFalhaDaIA() reconhece.
export const SCORE_DE_FALHA = 1;
const JUSTIFICATIVA_DE_FALHA =
  "Falha ao consultar ou interpretar a resposta do modelo de moderação (ver logs do servidor).";

export function registroDeFalha(erro: unknown) {
  return {
    scoreGeral: SCORE_DE_FALHA,
    justificativa: JUSTIFICATIVA_DE_FALHA,
    // O motivo fica aqui (e não na justificativa, que é texto de tela): "HTTP 503 UNAVAILABLE".
    resultadoJson: JSON.stringify({ falha: descreverFalha(erro) }),
  };
}

// O pipeline grava o registro de falha quando o modelo não responde: nota SCORE_DE_FALHA e nenhum
// eixo preenchido. Ele não é uma avaliação - contá-lo como "reprovada pela IA", mostrá-lo como
// "nota 1.00" ou entrar numa média distorceria tudo. As duas condições juntas: um registro antigo
// sem eixos mas com outra nota não é falha, só um registro sem detalhe.
export function ehFalhaDaIA(log: { scoreGeral: number; scoreOfensivo: number | null }): boolean {
  return log.scoreOfensivo === null && log.scoreGeral === SCORE_DE_FALHA;
}
