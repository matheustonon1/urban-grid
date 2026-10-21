import { formatarDataHora } from "@/lib/formatarData";

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
                className="absolute top-5 bottom-0 left-[5px] w-px bg-slate-200 dark:bg-slate-800"
              />
            )}
            <span
              aria-hidden
              className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 ${
                ultimo
                  ? "border-primary bg-primary"
                  : "border-slate-300 bg-background dark:border-slate-600"
              }`}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="font-medium text-slate-900 dark:text-slate-100">{evento.titulo}</p>
              <time
                dateTime={evento.data.toISOString()}
                className="text-xs tabular-nums text-slate-500 dark:text-slate-400"
              >
                {formatarDataHora(evento.data, locale)}
              </time>
              {evento.descricao && (
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{evento.descricao}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
