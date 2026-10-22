import type { ReactNode } from "react";
import type { StatusReclamacao } from "@prisma/client";
import { CalendarClock, Landmark } from "lucide-react";

import { StatusBadge } from "@/components/reclamacao/status-badge";
import { formatarData, formatarDataHora } from "@/lib/util/formatarData";

// A resposta do órgão é o dado que a pessoa mais quer ver numa reclamação, então
// tem bloco próprio (fundo azul-suave, selo do órgão) em vez de ser uma linha da
// linha do tempo. Mostra quem respondeu, quando, o que disse e o que mudou
// (novo status, prazo estimado).
export function RespostaOficial({
  orgao,
  texto,
  data,
  novoStatus,
  prazoEstimado,
  locale,
  rotulos,
}: {
  orgao: string;
  texto: string;
  data: Date;
  novoStatus: StatusReclamacao | null;
  prazoEstimado: Date | null;
  locale: string;
  rotulos: { respostaOficial: string; novoStatus: string; prazo: string };
}) {
  const fatos: { rotulo: string; valor: ReactNode }[] = [];
  if (novoStatus) fatos.push({ rotulo: rotulos.novoStatus, valor: <StatusBadge status={novoStatus} /> });
  if (prazoEstimado) {
    fatos.push({
      rotulo: rotulos.prazo,
      valor: (
        <span className="inline-flex items-center gap-1.5 font-medium text-ink">
          <CalendarClock className="h-4 w-4 text-brand" aria-hidden />
          <time dateTime={prazoEstimado.toISOString()}>{formatarData(prazoEstimado, locale)}</time>
        </span>
      ),
    });
  }

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-brand/30 bg-brand-soft p-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand">
            <Landmark className="h-4 w-4" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="kicker text-brand-ink">{rotulos.respostaOficial}</span>
            <span className="font-bold text-ink">{orgao}</span>
          </span>
        </p>
        <time
          dateTime={data.toISOString()}
          className="text-xs tabular-nums text-ink-muted"
        >
          {formatarDataHora(data, locale)}
        </time>
      </header>

      <p className="text-base leading-relaxed whitespace-pre-line text-ink">{texto}</p>

      {fatos.length > 0 && (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-brand/20 pt-4">
          {fatos.map((fato) => (
            <div key={fato.rotulo} className="flex flex-col gap-1">
              <dt className="kicker">{fato.rotulo}</dt>
              <dd>{fato.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
