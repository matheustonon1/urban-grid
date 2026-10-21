const COLUNAS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

// Faixa de números-chave: um painel só, com divisórias de 1px entre as
// células (o gap-px deixa o fundo do contêiner aparecer), números em
// mono/tabular - mesmo vocabulário do painel de estatísticas da home, não
// quatro cartões de "stat" soltos.
export function PainelNumeros({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-800 ${COLUNAS[itens.length] ?? "sm:grid-cols-4"}`}
    >
      {itens.map(({ rotulo, valor }) => (
        <div key={rotulo} className="flex flex-col gap-0.5 bg-white px-4 py-3.5 dark:bg-slate-900">
          <dt className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</dt>
          <dd className="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
