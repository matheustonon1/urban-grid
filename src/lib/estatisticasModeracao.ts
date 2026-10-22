import { LIMITE_REPROVACAO, LIMITE_REVISAO, nivelPontuacao, type NivelPontuacao } from "@/lib/pontuacoes";

// Cálculos da página de estatísticas de moderação, sem tocar no banco: o
// carregador (carregarEstatisticasModeracao) só busca as linhas e entrega a
// elas, e é aqui que os números nascem - dá pra testar com listas na mão.

export type Decisao = "APROVAR" | "ENCAMINHAR_REVISAO" | "REPROVAR";
export type TipoLog = "RECLAMACAO" | "COMENTARIO";

export interface LogEstatistica {
  alvoTipo: TipoLog;
  decisao: Decisao;
  scoreGeral: number;
  scoreOfensivo: number | null;
  scoreSpam: number | null;
  scoreDadosPessoais: number | null;
  scoreForaEscopo: number | null;
  scoreDesinformacao: number | null;
  coerenciaTextoImagem: number | null;
  versaoPrompt: string;
  latenciaMs: number | null;
  tokensEntrada: number | null;
  tokensSaida: number | null;
  decisaoFinal: Decisao | null;
  revisadoEm: Date | null;
  createdAt: Date;
}

// O pipeline grava um log de "falha" quando o modelo não responde (decisão
// forçada pro lado seguro, scoreGeral 1, nenhum eixo preenchido). Esse log
// não é uma avaliação: contar como "reprovada pela IA" ou entrar numa média
// de score distorceria tudo - então sai das taxas e vira um número à parte.
// As duas condições juntas: um registro antigo sem eixos mas com outro
// scoreGeral não é falha, só um registro sem detalhe.
export function ehFalhaDaIA(log: LogEstatistica): boolean {
  return log.scoreOfensivo === null && log.scoreGeral === 1;
}

// ---------------------------------------------------------------------------
// Período

export type ChavePeriodo = "7" | "30" | "90" | "todos";

export interface Periodo {
  chave: ChavePeriodo;
  dias: number | null;
}

export const PERIODOS: Periodo[] = [
  { chave: "7", dias: 7 },
  { chave: "30", dias: 30 },
  { chave: "90", dias: 90 },
  { chave: "todos", dias: null },
];

const PERIODO_PADRAO = PERIODOS[1];

export function interpretarPeriodo(valor: string | string[] | undefined): Periodo {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return PERIODOS.find((p) => p.chave === texto) ?? PERIODO_PADRAO;
}

const MS_DIA = 86_400_000;

// Começo (00:00 UTC) do dia de `data`. Tudo aqui conta dias em UTC, como a
// página fazia antes: o servidor roda em UTC e o dia do gráfico e o do
// filtro precisam ser o mesmo.
export function inicioDoDia(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Estatística básica

// Percentil por interpolação linear (p entre 0 e 1). Lista vazia -> null.
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const posicao = (ordenados.length - 1) * Math.min(Math.max(p, 0), 1);
  const abaixo = Math.floor(posicao);
  const acima = Math.ceil(posicao);
  return ordenados[abaixo] + (ordenados[acima] - ordenados[abaixo]) * (posicao - abaixo);
}

export function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

export function taxa(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}

// Variação relativa em % (contagens): 120 vs 100 -> 20. Sem base de
// comparação (anterior 0 ou ausente) devolve null em vez de "infinito".
export function variacaoRelativa(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

// Diferença em pontos percentuais (taxas, que são frações 0-1).
export function variacaoPontos(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null) return null;
  return (atual - anterior) * 100;
}

// ---------------------------------------------------------------------------
// Resumo de decisões

export interface ResumoDecisoes {
  total: number;
  validas: number; // total sem as falhas da IA
  falhas: number;
  aprovar: number;
  encaminhar: number;
  reprovar: number;
  taxaAprovar: number | null;
  taxaEncaminhar: number | null;
  taxaReprovar: number | null;
}

export function resumirDecisoes(logs: LogEstatistica[]): ResumoDecisoes {
  let aprovar = 0;
  let encaminhar = 0;
  let reprovar = 0;
  let falhas = 0;
  for (const log of logs) {
    if (ehFalhaDaIA(log)) {
      falhas++;
    } else if (log.decisao === "APROVAR") {
      aprovar++;
    } else if (log.decisao === "ENCAMINHAR_REVISAO") {
      encaminhar++;
    } else {
      reprovar++;
    }
  }
  const validas = aprovar + encaminhar + reprovar;
  return {
    total: logs.length,
    validas,
    falhas,
    aprovar,
    encaminhar,
    reprovar,
    taxaAprovar: taxa(aprovar, validas),
    taxaEncaminhar: taxa(encaminhar, validas),
    taxaReprovar: taxa(reprovar, validas),
  };
}

// Por que uma reclamação foi para a revisão humana. Uma análise que cai em
// "por pontuação" tem scoreGeral >= LIMITE_REVISAO; a que cai em
// "possível repostagem" foi aprovada pela IA mas a pré-checagem de phash
// forçou a revisão (scoreGeral abaixo do corte, mesmo assim encaminhada).
export interface MotivosDeRevisao {
  porPontuacao: number;
  porRepostagem: number;
  porFalha: number;
}

export function motivosDeRevisao(logs: LogEstatistica[]): MotivosDeRevisao {
  const motivos: MotivosDeRevisao = { porPontuacao: 0, porRepostagem: 0, porFalha: 0 };
  for (const log of logs) {
    if (log.alvoTipo !== "RECLAMACAO") continue;
    if (ehFalhaDaIA(log)) {
      if (log.decisao === "ENCAMINHAR_REVISAO") motivos.porFalha++;
    } else if (log.decisao === "ENCAMINHAR_REVISAO") {
      if (log.scoreGeral >= LIMITE_REVISAO) motivos.porPontuacao++;
      else motivos.porRepostagem++;
    }
  }
  return motivos;
}

// ---------------------------------------------------------------------------
// Histograma do scoreGeral

export const FAIXAS_HISTOGRAMA = 20; // de 0,05 em 0,05: 0,4 e 0,75 caem na borda de uma faixa

export interface FaixaHistograma {
  de: number;
  ate: number;
  quantidade: number;
  zona: NivelPontuacao;
}

export function histogramaScore(scores: number[]): FaixaHistograma[] {
  const faixas: FaixaHistograma[] = Array.from({ length: FAIXAS_HISTOGRAMA }, (_, i) => {
    const de = (i * 5) / 100;
    return { de, ate: ((i + 1) * 5) / 100, quantidade: 0, zona: nivelPontuacao(de) };
  });
  for (const score of scores) {
    // Arredonda a milésimos antes de dividir: 0,4 * 20 não é exatamente 8 em
    // ponto flutuante e cairia na faixa errada.
    const indice = Math.floor(Math.round(score * 1000) / (1000 / FAIXAS_HISTOGRAMA));
    faixas[Math.min(Math.max(indice, 0), FAIXAS_HISTOGRAMA - 1)].quantidade++;
  }
  return faixas;
}

// Teto do eixo vertical: o dobro de um número "redondo" (a linha do meio cai
// nesse número, sempre inteiro). 11 vira 12, 25 vira 30, 101 vira 120 - sem
// deixar metade do gráfico vazio, como um teto de 20 pro maior valor 11.
export function maximoLegivel(maior: number): number {
  const metade = Math.max(maior / 2, 1);
  const potencia = 10 ** Math.floor(Math.log10(metade));
  // Abaixo de 10 só inteiros (1, 2, 3...); de 10 em diante dá pra usar 12, 15, 25.
  const candidatos = potencia === 1 ? [1, 2, 3, 4, 5, 6, 8, 10] : [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const escolhido = candidatos.find((c) => c * potencia >= metade) ?? 10;
  return Math.max(2 * escolhido * potencia, 4);
}

// ---------------------------------------------------------------------------
// Volume ao longo do tempo

export type Granularidade = "dia" | "semana" | "mes";

export interface BucketVolume {
  chave: string; // YYYY-MM-DD do início do bucket (YYYY-MM-01 no mês)
  inicio: Date;
  aprovar: number;
  encaminhar: number;
  reprovar: number;
  falhas: number;
  total: number;
}

function inicioDoBucket(data: Date, granularidade: Granularidade): Date {
  const dia = inicioDoDia(data);
  if (granularidade === "dia") return dia;
  if (granularidade === "mes") return new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), 1));
  // Semana começa na segunda-feira (getUTCDay: domingo = 0).
  const deslocamento = (dia.getUTCDay() + 6) % 7;
  return new Date(dia.getTime() - deslocamento * MS_DIA);
}

function proximoBucket(inicio: Date, granularidade: Granularidade): Date {
  if (granularidade === "dia") return new Date(inicio.getTime() + MS_DIA);
  if (granularidade === "semana") return new Date(inicio.getTime() + 7 * MS_DIA);
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
}

export function chaveDoBucket(inicio: Date): string {
  return inicio.toISOString().slice(0, 10);
}

// Dia até ~31 dias, semana até ~26 semanas, mês depois disso - mais barras
// que isso deixam de ser legíveis (marca fina demais) e o leitor quer a
// tendência, não o dia exato.
export function escolherGranularidade(diasNoPeriodo: number): Granularidade {
  if (diasNoPeriodo <= 31) return "dia";
  if (diasNoPeriodo <= 26 * 7) return "semana";
  return "mes";
}

// Buckets contíguos de `de` até `ate` (inclusive), com zeros onde não houve
// análise - um dia vazio é informação, não ausência de barra.
export function volumePorPeriodo(
  logs: LogEstatistica[],
  de: Date,
  ate: Date,
  granularidade: Granularidade
): BucketVolume[] {
  const buckets: BucketVolume[] = [];
  const porChave = new Map<string, BucketVolume>();
  const ultimo = inicioDoBucket(ate, granularidade);
  for (
    let inicio = inicioDoBucket(de, granularidade);
    inicio.getTime() <= ultimo.getTime();
    inicio = proximoBucket(inicio, granularidade)
  ) {
    const bucket: BucketVolume = {
      chave: chaveDoBucket(inicio),
      inicio,
      aprovar: 0,
      encaminhar: 0,
      reprovar: 0,
      falhas: 0,
      total: 0,
    };
    buckets.push(bucket);
    porChave.set(bucket.chave, bucket);
  }
  for (const log of logs) {
    const bucket = porChave.get(chaveDoBucket(inicioDoBucket(log.createdAt, granularidade)));
    if (!bucket) continue;
    bucket.total++;
    if (ehFalhaDaIA(log)) bucket.falhas++;
    else if (log.decisao === "APROVAR") bucket.aprovar++;
    else if (log.decisao === "ENCAMINHAR_REVISAO") bucket.encaminhar++;
    else bucket.reprovar++;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// O que dispara a revisão, por eixo

export type Eixo =
  | "ofensivo"
  | "spam"
  | "dadosPessoais"
  | "foraDeEscopo"
  | "desinformacao"
  | "coerenciaTextoImagem";

const EIXOS_RECLAMACAO: Eixo[] = [
  "ofensivo",
  "spam",
  "dadosPessoais",
  "foraDeEscopo",
  "desinformacao",
  "coerenciaTextoImagem",
];
const EIXOS_COMENTARIO: Eixo[] = ["ofensivo", "spam", "dadosPessoais"];

function valorDoEixo(log: LogEstatistica, eixo: Eixo): number | null {
  switch (eixo) {
    case "ofensivo":
      return log.scoreOfensivo;
    case "spam":
      return log.scoreSpam;
    case "dadosPessoais":
      return log.scoreDadosPessoais;
    case "foraDeEscopo":
      return log.scoreForaEscopo;
    case "desinformacao":
      return log.scoreDesinformacao;
    case "coerenciaTextoImagem":
      return log.coerenciaTextoImagem;
  }
}

export interface DisparoPorEixo {
  eixo: Eixo;
  amostra: number; // análises em que o eixo foi avaliado
  disparos: number; // quantas passaram do corte
  taxa: number | null;
  mediaRisco: number | null; // média do risco (coerência já invertida)
}

// Em quantas análises cada eixo passou do corte de atenção. Coerência
// texto/imagem só existe em reclamações com foto e é o contrário dos outros
// (alto = bom), então o risco dela é 1 - valor. Ordenado do que mais dispara.
export function disparosPorEixo(
  logs: LogEstatistica[],
  tipo: TipoLog,
  limite: number
): DisparoPorEixo[] {
  const eixos = tipo === "RECLAMACAO" ? EIXOS_RECLAMACAO : EIXOS_COMENTARIO;
  const avaliadas = logs.filter((log) => log.alvoTipo === tipo && !ehFalhaDaIA(log));
  return eixos
    .map((eixo) => {
      const riscos = avaliadas
        .map((log) => valorDoEixo(log, eixo))
        .filter((valor): valor is number => valor !== null)
        .map((valor) => (eixo === "coerenciaTextoImagem" ? 1 - valor : valor));
      const disparos = riscos.filter((risco) => risco >= limite).length;
      return {
        eixo,
        amostra: riscos.length,
        disparos,
        taxa: taxa(disparos, riscos.length),
        mediaRisco: media(riscos),
      };
    })
    .sort((a, b) => b.disparos - a.disparos || (b.taxa ?? 0) - (a.taxa ?? 0));
}

// ---------------------------------------------------------------------------
// IA x revisão humana

// Poucas revisões não dizem nada sobre a IA: com 3 casos, "67% revertidas"
// é ruído. Abaixo disto a tela mostra o número, mas avisa que é pouco.
export const AMOSTRA_MINIMA = 10;

export interface RevisaoHumana {
  tipo: TipoLog;
  paraRevisar: number; // análises cuja decisão pede um humano (ver abaixo)
  revisadas: number;
  pendentes: number;
  aprovadasPorHumano: number;
  rejeitadasPorHumano: number;
  taxaAprovadaPorHumano: number | null;
  medianaMs: number | null; // do log ao veredito humano
  amostraPequena: boolean;
}

// O que "precisa de humano" muda por tipo: numa reclamação é a revisão
// (ENCAMINHAR_REVISAO) - aprovar ou rejeitar ali é o fluxo normal. Num
// comentário é a reprovação da IA, que um moderador confirma ou desfaz;
// desfazer (aprovar) é um falso positivo da IA, o sinal que mais interessa.
export function revisaoHumana(logs: LogEstatistica[], tipo: TipoLog): RevisaoHumana {
  const alvo: Decisao = tipo === "RECLAMACAO" ? "ENCAMINHAR_REVISAO" : "REPROVAR";
  const paraRevisar = logs.filter((log) => log.alvoTipo === tipo && log.decisao === alvo);
  const revisadas = paraRevisar.filter((log) => log.decisaoFinal !== null);
  const aprovadas = revisadas.filter((log) => log.decisaoFinal === "APROVAR").length;
  const tempos = revisadas
    .filter((log) => log.revisadoEm !== null)
    .map((log) => Math.max(log.revisadoEm!.getTime() - log.createdAt.getTime(), 0));
  return {
    tipo,
    paraRevisar: paraRevisar.length,
    revisadas: revisadas.length,
    pendentes: paraRevisar.length - revisadas.length,
    aprovadasPorHumano: aprovadas,
    rejeitadasPorHumano: revisadas.length - aprovadas,
    taxaAprovadaPorHumano: taxa(aprovadas, revisadas.length),
    medianaMs: percentil(tempos, 0.5),
    amostraPequena: revisadas.length < AMOSTRA_MINIMA,
  };
}

// ---------------------------------------------------------------------------
// Versões do prompt

export interface LinhaVersao {
  tipo: TipoLog;
  versao: string;
  analises: number;
  taxaAprovar: number | null;
  taxaEncaminhar: number | null;
  taxaReprovar: number | null;
  latenciaP50Ms: number | null;
  ultimaVez: Date;
}

export function porVersaoDoPrompt(logs: LogEstatistica[]): LinhaVersao[] {
  const grupos = new Map<string, LogEstatistica[]>();
  for (const log of logs) {
    const chave = `${log.alvoTipo}|${log.versaoPrompt}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), log]);
  }
  return [...grupos.values()]
    .map((grupo) => {
      const resumo = resumirDecisoes(grupo);
      const latencias = grupo
        .filter((log) => !ehFalhaDaIA(log) && log.latenciaMs !== null)
        .map((log) => log.latenciaMs as number);
      return {
        tipo: grupo[0].alvoTipo,
        versao: grupo[0].versaoPrompt,
        analises: grupo.length,
        taxaAprovar: resumo.taxaAprovar,
        taxaEncaminhar: resumo.taxaEncaminhar,
        taxaReprovar: resumo.taxaReprovar,
        latenciaP50Ms: percentil(latencias, 0.5),
        ultimaVez: new Date(Math.max(...grupo.map((log) => log.createdAt.getTime()))),
      };
    })
    .sort(
      (a, b) =>
        a.tipo.localeCompare(b.tipo) || b.ultimaVez.getTime() - a.ultimaVez.getTime()
    );
}

// ---------------------------------------------------------------------------
// Consumo do modelo

export interface Consumo {
  tokensEntrada: number;
  tokensSaida: number;
  tokensPorAnalise: number | null;
  latenciaP50Ms: number | null;
  latenciaP95Ms: number | null;
  latenciaMaxMs: number | null;
}

export function consumoDoModelo(logs: LogEstatistica[]): Consumo {
  const validas = logs.filter((log) => !ehFalhaDaIA(log));
  const latencias = validas.filter((log) => log.latenciaMs !== null).map((log) => log.latenciaMs as number);
  const tokensEntrada = validas.reduce((soma, log) => soma + (log.tokensEntrada ?? 0), 0);
  const tokensSaida = validas.reduce((soma, log) => soma + (log.tokensSaida ?? 0), 0);
  return {
    tokensEntrada,
    tokensSaida,
    tokensPorAnalise: validas.length > 0 ? (tokensEntrada + tokensSaida) / validas.length : null,
    latenciaP50Ms: percentil(latencias, 0.5),
    latenciaP95Ms: percentil(latencias, 0.95),
    latenciaMaxMs: latencias.length > 0 ? Math.max(...latencias) : null,
  };
}

// ---------------------------------------------------------------------------
// Filas e denúncias

export interface IdadesDaFila {
  total: number;
  ate24h: number;
  de24a72h: number;
  mais72h: number;
  maisAntigaMs: number | null;
}

// Mesmos cortes de tempo-na-fila.tsx (24 h atenção, 72 h urgente).
export function idadesDaFila(desde: Date[], agora: Date): IdadesDaFila {
  const idades = desde.map((data) => Math.max(agora.getTime() - data.getTime(), 0));
  const horas = (ms: number) => ms / 3_600_000;
  return {
    total: idades.length,
    ate24h: idades.filter((ms) => horas(ms) < 24).length,
    de24a72h: idades.filter((ms) => horas(ms) >= 24 && horas(ms) < 72).length,
    mais72h: idades.filter((ms) => horas(ms) >= 72).length,
    maisAntigaMs: idades.length > 0 ? Math.max(...idades) : null,
  };
}

export interface DenunciaEstatistica {
  motivo: string;
  status: "ABERTA" | "PROCEDENTE" | "IMPROCEDENTE";
  createdAt: Date;
  analisadoEm: Date | null;
}

export interface ResumoDenuncias {
  total: number;
  procedentes: number;
  improcedentes: number;
  emAberto: number;
  taxaProcedente: number | null;
  porMotivo: { motivo: string; quantidade: number }[];
  medianaResolucaoMs: number | null;
}

export function resumirDenuncias(denuncias: DenunciaEstatistica[]): ResumoDenuncias {
  const procedentes = denuncias.filter((d) => d.status === "PROCEDENTE").length;
  const improcedentes = denuncias.filter((d) => d.status === "IMPROCEDENTE").length;
  const contagemMotivos = new Map<string, number>();
  for (const d of denuncias) contagemMotivos.set(d.motivo, (contagemMotivos.get(d.motivo) ?? 0) + 1);
  const tempos = denuncias
    .filter((d) => d.analisadoEm !== null)
    .map((d) => Math.max(d.analisadoEm!.getTime() - d.createdAt.getTime(), 0));
  return {
    total: denuncias.length,
    procedentes,
    improcedentes,
    emAberto: denuncias.length - procedentes - improcedentes,
    taxaProcedente: taxa(procedentes, procedentes + improcedentes),
    porMotivo: [...contagemMotivos.entries()]
      .map(([motivo, quantidade]) => ({ motivo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    medianaResolucaoMs: percentil(tempos, 0.5),
  };
}

export { LIMITE_REPROVACAO, LIMITE_REVISAO };
