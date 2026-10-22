import { formatarDataHora } from "@/lib/util/formatarData";

import type { EventoTimeline } from "./linha-do-tempo";

// Trilho vertical com um ponto por evento (o mais recente, preenchido).
// Substitui a pilha de cartões: cada evento ocupava um cartão inteiro, e a
// sequência no tempo - que é a informação - se perdia no peso visual.
export function LinhaDoTempoVisual({
  eventos,
  locale,
}: {
  eventos: EventoTimeline[];
  locale: string;
}) {
  return (
    <ol className="flex flex-col">
      {eventos.map((evento, indice) => {
        const ultimo = indice === eventos.length - 1;

        return (
          <li key={indice} className="relative flex gap-4 pb-6 last:pb-0">
            {!ultimo && (
              <span
                aria-hidden
                className="absolute top-5 bottom-0 left-1.25 w-px bg-line"
              />
            )}
            <span
              aria-hidden
              className={`relative mt-1.5 h-2.75 w-2.75 shrink-0 rounded-full border-2 ${
                ultimo
                  ? "border-brand bg-brand"
                  : "border-line-strong bg-paper"
              }`}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium text-ink">{evento.titulo}</p>
              <time
                dateTime={evento.data.toISOString()}
                className="text-xs tabular-nums text-ink-muted"
              >
                {formatarDataHora(evento.data, locale)}
              </time>
              {evento.descricao && (
                <p className="mt-1 text-sm text-ink-2">{evento.descricao}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
