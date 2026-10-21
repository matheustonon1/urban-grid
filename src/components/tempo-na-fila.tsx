import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { formatarDataHora } from "@/lib/formatarData";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";

const HORAS_ATENCAO = 24;
const HORAS_URGENTE = 72;

function horasDesde(data: Date): number {
  return (Date.now() - data.getTime()) / 3_600_000;
}

// Há quanto tempo o item espera revisão. A fila é ordenada do mais antigo
// pro mais novo; a cor avisa de relance o que já passou de um dia (âmbar) ou
// de três (vermelho) - o moderador não precisa fazer a conta de cabeça.
export function TempoNaFila({ desde }: { desde: Date }) {
  const t = useTranslations("Moderacao");
  const locale = useLocale();
  const horas = horasDesde(desde);
  const titulo = t("naFilaDesde", { data: formatarDataHora(desde, locale) });

  const tom =
    horas >= HORAS_URGENTE
      ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
      : horas >= HORAS_ATENCAO
        ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";

  return (
    <span
      title={titulo}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tom}`}
    >
      <Clock className="h-3 w-3" aria-hidden />
      <span className="sr-only">{titulo}: </span>
      <time dateTime={desde.toISOString()}>{formatarTempoRelativo(desde, locale)}</time>
    </span>
  );
}
