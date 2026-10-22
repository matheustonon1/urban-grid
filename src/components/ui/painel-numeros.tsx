const COLUNAS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

// Faixa de números-chave: um painel só, com divisórias de 1px entre as células
// (o gap-px deixa o fundo do contêiner aparecer), números em mono/tabular - a
// mesma linguagem de placar técnico da home, não quatro cartões de "stat"
// soltos.
export function PainelNumeros({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line ${COLUNAS[itens.length] ?? "sm:grid-cols-4"}`}
    >
      {itens.map(({ rotulo, valor }) => (
        <div key={rotulo} className="flex flex-col gap-1 bg-surface px-4 py-3.5">
          <dt className="kicker">{rotulo}</dt>
          <dd className="font-mono text-2xl font-medium tabular-nums text-ink">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
