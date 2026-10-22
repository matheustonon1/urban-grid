import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { formatarDataHora } from "@/lib/util/formatarData";
import { formatarTempoRelativo } from "@/lib/util/tempo-relativo";

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
      ? "bg-danger-soft text-danger-ink"
      : horas >= HORAS_ATENCAO
        ? "bg-warn-soft text-warn-ink"
        : "bg-sunken text-ink-2";

  return (
    <span
      title={titulo}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-xs leading-5 font-semibold ${tom}`}
    >
      <Clock className="h-3 w-3" aria-hidden />
      <span className="sr-only">{titulo}: </span>
      <time dateTime={desde.toISOString()}>{formatarTempoRelativo(desde, locale)}</time>
    </span>
  );
}
