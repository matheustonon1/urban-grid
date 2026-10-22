import type { ReactNode } from "react";

import { cartaoSecao } from "@/lib/estilos";

// Uma etapa do formulário: número, título e uma linha dizendo o que se espera
// ali. O número é só orientação (a página é uma só, sem "próximo") - mostra
// que o formulário tem fim e quanto falta.
export function SecaoFormulario({
  id,
  numero,
  titulo,
  descricao,
  children,
}: {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className={`flex flex-col gap-5 ${cartaoSecao}`}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 font-mono text-sm font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
        >
          {numero}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={`${id}-titulo`}
            className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {titulo}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
        </div>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
