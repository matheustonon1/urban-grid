const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// locale por parâmetro (não fixo) - a maioria das chamadas está em
// páginas ainda só em português (mantêm o padrão "pt-BR"), mas
// componentes já traduzidos (ex.: NotificacoesSino) passam o locale
// ativo via useLocale().
export function formatarTempoRelativo(data: Date, locale: string = "pt-BR"): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const segundos = (data.getTime() - Date.now()) / 1000;

  for (const [unidade, segundosPorUnidade] of UNIDADES) {
    if (Math.abs(segundos) >= segundosPorUnidade) {
      return rtf.format(Math.round(segundos / segundosPorUnidade), unidade);
    }
  }

  return rtf.format(Math.round(segundos / 60), "minute");
}
