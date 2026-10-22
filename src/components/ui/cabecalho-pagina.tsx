import type { ReactNode } from "react";

// Cabeçalho padrão das páginas internas: título, subtítulo opcional e ações à
// direita (embaixo, em tela estreita; o subtítulo quebra de linha em vez de
// empurrar a ação pra baixo). Um fio de 1px fecha o bloco - separa "onde estou"
// do conteúdo sem precisar de cartão.
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
    <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1.5 sm:flex-1">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
          {titulo}
        </h1>
        {descricao && <p className="max-w-prose text-ink-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acoes}</div>}
    </header>
  );
}
