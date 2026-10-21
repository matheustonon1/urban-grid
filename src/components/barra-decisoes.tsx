import type { DecisaoModeracao } from "@prisma/client";
import { useTranslations } from "next-intl";

const ORDEM: DecisaoModeracao[] = ["APROVAR", "ENCAMINHAR_REVISAO", "REPROVAR"];

const COR: Record<DecisaoModeracao, string> = {
  APROVAR: "bg-green-600 dark:bg-green-500",
  ENCAMINHAR_REVISAO: "bg-amber-500",
  REPROVAR: "bg-red-600 dark:bg-red-500",
};

// Distribuição das decisões da IA numa barra única empilhada (parte de um
// todo), em vez de uma linha de texto "Aprovar: 12 (60%) Revisão: ...". A
// legenda abaixo repete número e porcentagem - a barra sozinha não diz
// valores, e cor nunca é o único portador da informação.
export function BarraDecisoes({
  contagens,
}: {
  contagens: Partial<Record<DecisaoModeracao, number>>;
}) {
  const t = useTranslations("Decisao");
  const total = ORDEM.reduce((soma, decisao) => soma + (contagens[decisao] ?? 0), 0);
  if (total === 0) return null;

  const partes = ORDEM.map((decisao) => {
    const quantidade = contagens[decisao] ?? 0;
    return { decisao, quantidade, pct: Math.round((quantidade / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={partes.map((p) => `${t(p.decisao)}: ${p.quantidade} (${p.pct}%)`).join(", ")}
        className="flex h-2.5 gap-px overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        {partes.map(
          ({ decisao, quantidade }) =>
            quantidade > 0 && (
              <div
                key={decisao}
                className={COR[decisao]}
                style={{ width: `${(quantidade / total) * 100}%` }}
              />
            )
        )}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {partes
          .filter(({ quantidade }) => quantidade > 0)
          .map(({ decisao, quantidade, pct }) => (
            <li
              key={decisao}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${COR[decisao]}`} />
              {t(decisao)}
              <span className="font-mono font-medium tabular-nums">{quantidade}</span>
              <span className="text-slate-400 dark:text-slate-500">({pct}%)</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
