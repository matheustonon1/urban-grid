import type { Granularidade } from "@/lib/moderacao/estatisticas";

// Formatadores da página de estatísticas, todos com o locale por parâmetro.

export function formatarPorcentagem(fracao: number | null, locale: string): string {
  if (fracao === null) return "—";
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fracao);
}

export function formatarNumero(valor: number | null, locale: string, casas = 0): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: casas }).format(valor);
}

// Duração curta e arredondada: "45 min", "3,5 h", "2 d". Estatística de fila
// não precisa de precisão de minuto quando o assunto são dias.
export function formatarDuracao(ms: number | null, locale: string): string {
  if (ms === null) return "—";
  const minutos = ms / 60_000;
  if (minutos < 1) return "< 1 min";
  if (minutos < 60) return `${formatarNumero(Math.round(minutos), locale)} min`;
  const horas = minutos / 60;
  if (horas < 48) return `${formatarNumero(horas, locale, horas < 10 ? 1 : 0)} h`;
  return `${formatarNumero(horas / 24, locale, 1)} d`;
}

// Latência do modelo: milissegundos viram segundos com uma casa.
export function formatarLatencia(ms: number | null, locale: string): string {
  if (ms === null) return "—";
  return `${formatarNumero(ms / 1000, locale, 1)} s`;
}

// Rótulo curto do início de um bucket do gráfico de volume (sempre em UTC, o
// mesmo fuso em que os buckets são montados).
export function formatarBucket(inicio: Date, granularidade: Granularidade, locale: string): string {
  const opcoes: Intl.DateTimeFormatOptions =
    granularidade === "mes"
      ? { month: "short", year: "2-digit", timeZone: "UTC" }
      : { day: "2-digit", month: "2-digit", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, opcoes).format(inicio);
}

// Variação com sinal explícito: "+12%", "−3,5 pp". Menos tipográfico (U+2212)
// pra não parecer hífen de lista.
export function formatarVariacao(valor: number, locale: string, unidade: "%" | "pp"): string {
  const abs = Math.abs(valor);
  const texto = new Intl.NumberFormat(locale, { maximumFractionDigits: abs < 10 ? 1 : 0 }).format(abs);
  const sinal = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${sinal}${texto}${unidade === "%" ? "%" : " pp"}`;
}
