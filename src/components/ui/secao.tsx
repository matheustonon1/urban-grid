import type { ReactNode } from "react";

// Seção de página: o título leva uma régua de tinta de 2px embaixo (o "índice"
// de planta técnica) em vez de flutuar solto. É o único título de seção do
// site - listas, painéis, comentários e estatísticas usam este.
//
// `contador` é um número em mono ao lado do título (quantos itens há); `acoes`
// fica à direita (filtro, "ver todas", botão). O id liga o <section> ao título
// (aria-labelledby): leitor de tela navega por região nomeada.
export function Secao({
  id,
  titulo,
  contador,
  descricao,
  acoes,
  children,
}: {
  id: string;
  titulo: string;
  contador?: number | string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const idTitulo = `${id}-titulo`;

  return (
    <section id={id} aria-labelledby={idTitulo} className="flex min-w-0 scroll-mt-24 flex-col gap-5">
      <header className="flex flex-col gap-1.5 border-b-2 border-ink pb-2.5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id={idTitulo} className="text-xl leading-tight font-extrabold tracking-tight text-ink">
              {titulo}
            </h2>
            {contador !== undefined && <span className="kicker tabular-nums">{contador}</span>}
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </div>
        {descricao && <p className="text-sm text-ink-muted">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}
