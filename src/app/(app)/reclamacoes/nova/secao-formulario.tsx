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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink font-mono text-sm font-medium text-paper"
        >
          {numero}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2
            id={`${id}-titulo`}
            className="text-xl font-extrabold tracking-tight text-ink"
          >
            {titulo}
          </h2>
          <p className="text-sm text-ink-muted">{descricao}</p>
        </div>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
