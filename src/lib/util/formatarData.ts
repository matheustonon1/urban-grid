// Datas e horas do site, sempre no mesmo fuso, em qualquer ambiente.
//
// As telas são renderizadas no servidor, e sem `timeZone` o Intl usa o fuso do PROCESSO: o
// computador de quem desenvolve mostrava um horário e a Vercel (UTC) mostrava outro, 3 horas
// adiantado para quem está no Brasil - e perto da meia-noite, até o dia errado. O site é
// brasileiro, então tudo que é instante (criação, resposta, notificação) aparece no horário de
// Brasília. O Brasil não tem horário de verão desde 2019, então Brasília é UTC-3 o ano todo.
export const FUSO = "America/Sao_Paulo";

// Data legível, no idioma ativo: "21 de out. de 2026" / "Oct 21, 2026".
// Antes as telas usavam toLocaleString() sem opções, que despeja
// "21/10/2026, 17:12:41" - segundos e vírgula incluídos - em qualquer lugar.
export function formatarData(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: FUSO }).format(data);
}

export function formatarDataHora(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(data);
}

// Só a hora ("14:32" / "2:32 PM"), no mesmo fuso das outras datas da tela.
export function formatarHora(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: FUSO }).format(data);
}

// "21/10/2026": para onde o espaço é curto e a data por extenso não cabe.
export function formatarDataNumerica(data: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: FUSO,
  }).format(data);
}

// DIA DE CALENDÁRIO (o prazo estimado de uma resposta): quem escolhe num <input type="date"> escolhe
// um dia, sem hora, e ele é guardado como a meia-noite UTC daquele dia. Formatado no fuso de
// Brasília viraria a noite do dia ANTERIOR ("15/01" aparecia "14 de jan."); em UTC mostra o dia
// que a pessoa escolheu. Use isto só para esse tipo de valor, nunca para um instante.
export function formatarDiaCalendario(dia: Date, locale: string = "pt-BR"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(dia);
}

const DIA_MS = 24 * 60 * 60 * 1000;
const BRASILIA_MS = 3 * 60 * 60 * 1000;

// Um dia de calendário vence no FIM dele, em Brasília (a meia-noite de Brasília é 03:00 UTC do dia
// seguinte), e não no começo. "Prazo: 15 de janeiro" significa até o fim do dia 15; comparar o
// dia (meia-noite UTC) direto com agora marcava o prazo como vencido na tarde do dia anterior.
export function diaCalendarioVencido(dia: Date, agora: Date = new Date()): boolean {
  return agora.getTime() >= dia.getTime() + DIA_MS + BRASILIA_MS;
}
