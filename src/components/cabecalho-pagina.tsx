import type { ReactNode } from "react";

// Cabeçalho padrão das páginas internas: título, subtítulo opcional e ações
// à direita (quebram pra baixo em tela estreita). Antes cada página repetia
// o <h1> solto, sem subtítulo nem lugar pra um botão de ação.
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {titulo}
        </h1>
        {descricao && (
          <p className="max-w-prose text-slate-600 dark:text-slate-400">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
