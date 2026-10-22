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
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
      {itens.map(({ rotulo, valor, variacao, detalhe }) => {
        const Seta = variacao ? SETA[variacao.direcao] : null;
        return (
          <div key={rotulo} className="flex flex-col gap-1 bg-white px-4 py-4 dark:bg-slate-900">
            <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{rotulo}</dt>
            <dd className="flex flex-col gap-1">
              <span className="font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {valor}
              </span>
              {variacao && Seta && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <Seta className="h-3.5 w-3.5" aria-hidden />
                  <span className="font-mono font-medium tabular-nums">{variacao.texto}</span>
                  <span aria-hidden className="text-slate-400 dark:text-slate-500">
                    {rotuloComparacao}
                  </span>
                  <span className="sr-only">{descricaoComparacao}</span>
                </span>
              )}
              {detalhe && <span className="text-xs text-slate-500 dark:text-slate-400">{detalhe}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
