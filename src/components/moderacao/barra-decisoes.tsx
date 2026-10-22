import type { DecisaoModeracao } from "@prisma/client";
import { useTranslations } from "next-intl";

const ORDEM: DecisaoModeracao[] = ["APROVAR", "ENCAMINHAR_REVISAO", "REPROVAR"];

// Exportada: gráficos de estatísticas usam as mesmas cores pra mesma decisão.
export const COR_DECISAO: Record<DecisaoModeracao, string> = {
  APROVAR: "bg-ok-ink",
  ENCAMINHAR_REVISAO: "bg-warn-ink",
  REPROVAR: "bg-danger-ink",
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
        className="flex h-2.5 gap-px overflow-hidden rounded-full bg-sunken"
      >
        {partes.map(
          ({ decisao, quantidade }) =>
            quantidade > 0 && (
              <div
                key={decisao}
                className={COR_DECISAO[decisao]}
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
              className="flex items-center gap-1.5 text-ink-2"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${COR_DECISAO[decisao]}`} />
              {t(decisao)}
              <span className="font-mono font-medium tabular-nums">{quantidade}</span>
              <span className="text-ink-muted">({pct}%)</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
