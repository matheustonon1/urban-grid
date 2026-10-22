import type { ReactNode } from "react";

// Cabeçalho padrão das páginas internas: título, subtítulo opcional e ações à
// direita (embaixo, em tela estreita; o subtítulo quebra de linha em vez de
// empurrar a ação pra baixo). Uma régua de tinta de 2px fecha o bloco - separa
// "onde estou" do conteúdo sem precisar de cartão, e é a mesma das `Secao`.
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
  kicker,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  // Rótulo mono acima do título (onde a pessoa está: "Administração", "Minha área").
  kicker?: string;
}) {
  return (
    <header className="flex flex-col gap-4 border-b-2 border-ink pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-1">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
          {titulo}
        </h1>
        {descricao && <p className="max-w-prose text-lg text-ink-muted">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acoes}</div>}
    </header>
  );
}
