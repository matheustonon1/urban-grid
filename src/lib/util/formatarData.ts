// Data legível, no idioma ativo: "21 de out. de 2026" / "Oct 21, 2026".
// Antes as telas usavam toLocaleString() sem opções, que despeja
// "21/10/2026, 17:12:41" - segundos e vírgula incluídos - em qualquer lugar.
export function formatarData(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(data);
}

export function formatarDataHora(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(data);
}
