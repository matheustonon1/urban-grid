import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export interface Variacao {
  texto: string; // "+12%", "−3,5 pp"
  direcao: "sobe" | "desce" | "igual";
}

export interface Kpi {
  rotulo: string;
  valor: string;
  variacao?: Variacao | null;
  detalhe?: string;
}

const SETA = { sobe: ArrowUp, desce: ArrowDown, igual: Minus } as const;

// Números-chave do período, com a variação em relação ao período anterior.
// A seta e a cor da variação são neutras de propósito: "subiu" não é bom nem
// ruim por si só (mais aprovação automática pode ser eficiência ou frouxidão),
// e verde/vermelho aqui diriam um julgamento que o dado não faz.
export function Kpis({
  itens,
  rotuloComparacao,
  descricaoComparacao,
}: {
  itens: Kpi[];
  rotuloComparacao: string;
  descricaoComparacao: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
      {itens.map(({ rotulo, valor, variacao, detalhe }) => {
        const Seta = variacao ? SETA[variacao.direcao] : null;
        return (
          <div key={rotulo} className="flex flex-col gap-2 bg-surface px-5 py-5">
            <dt className="kicker">{rotulo}</dt>
            <dd className="flex flex-col gap-1">
              <span className="font-mono text-4xl font-medium tabular-nums text-ink">
                {valor}
              </span>
              {variacao && Seta && (
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Seta className="h-3.5 w-3.5" aria-hidden />
                  <span className="font-mono font-medium tabular-nums">{variacao.texto}</span>
                  <span aria-hidden className="text-ink-muted">
                    {rotuloComparacao}
                  </span>
                  <span className="sr-only">{descricaoComparacao}</span>
                </span>
              )}
              {detalhe && <span className="text-xs text-ink-muted">{detalhe}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
