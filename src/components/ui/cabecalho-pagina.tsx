import type { ReactNode } from "react";

// Cabeçalho padrão das páginas internas: título, subtítulo opcional e ações
// à direita (embaixo, em tela estreita; o subtítulo quebra de linha em vez de
// empurrar a ação pra baixo). Antes cada página repetia
// o <h1> solto, sem subtítulo nem lugar pra um botão de ação.
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          {titulo}
        </h1>
        {descricao && (
          <p className="max-w-prose text-slate-600 dark:text-slate-400">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acoes}</div>}
    </header>
  );
}
