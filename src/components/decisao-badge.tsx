import type { DecisaoModeracao } from "@prisma/client";
import { useTranslations } from "next-intl";

// Mesma linguagem do StatusBadge (pílula + ponto): verde aprova, âmbar manda
// pra revisão humana, vermelho reprova. Eram cópias soltas de mapas de cor em
// três telas de moderação.
const ESTILO: Record<DecisaoModeracao, string> = {
  APROVAR: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  REPROVAR: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  ENCAMINHAR_REVISAO: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

export function DecisaoBadge({
  decisao,
  origem,
}: {
  decisao: DecisaoModeracao;
  // Quem decidiu, entre parênteses ("IA", "humano"), quando importa.
  origem?: string;
}) {
  const t = useTranslations("Decisao");

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILO[decisao]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(decisao)}
      {origem && ` (${origem})`}
    </span>
  );
}
