// Pontuações da moderação por IA, uma barra por eixo, para o moderador
// bater o olho no que motivou o encaminhamento. Os cortes são os do próprio
// pipeline (decidir() em lib/moderacao): >= 0,75 reprova, >= 0,4 manda pra
// revisão humana - antes eram cinco linhas de texto com o mesmo peso, e o
// eixo que causou o alerta se perdia entre os que estavam normais.
const LIMITE_REVISAO = 0.4;
const LIMITE_REPROVACAO = 0.75;

type Pontuacao = {
  rotulo: string;
  valor: number | null | undefined;
  // Linha inteira e barra mais grossa: a nota geral é o que decide, os eixos
  // abaixo explicam de onde ela veio.
  destaque?: boolean;
  // Coerência texto/imagem é o contrário dos outros eixos: quanto MAIOR,
  // melhor. Nela o alerta é o valor baixo.
  invertido?: boolean;
};

function nivel(valor: number, invertido: boolean): "ok" | "atencao" | "alto" {
  const risco = invertido ? 1 - valor : valor;
  if (risco >= LIMITE_REPROVACAO) return "alto";
  if (risco >= LIMITE_REVISAO) return "atencao";
  return "ok";
}

const COR_BARRA = {
  ok: "bg-slate-400 dark:bg-slate-500",
  atencao: "bg-amber-500",
  alto: "bg-red-600 dark:bg-red-500",
} as const;

const COR_VALOR = {
  ok: "text-slate-500 dark:text-slate-400",
  atencao: "font-semibold text-amber-700 dark:text-amber-400",
  alto: "font-semibold text-red-700 dark:text-red-400",
} as const;

export function PontuacoesIA({ itens }: { itens: Pontuacao[] }) {
  const visiveis = itens.filter(
    (item): item is Pontuacao & { valor: number } => typeof item.valor === "number"
  );

  return (
    <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {visiveis.map(({ rotulo, valor, invertido = false, destaque = false }) => {
        const n = nivel(valor, invertido);
        return (
          <li key={rotulo} className={`flex flex-col gap-1 ${destaque ? "sm:col-span-2" : ""}`}>
            <div
              className={`flex items-baseline justify-between gap-2 ${destaque ? "text-sm font-medium" : "text-xs"}`}
            >
              <span className="text-slate-600 dark:text-slate-300">{rotulo}</span>
              <span className={`font-mono tabular-nums ${COR_VALOR[n]}`}>{valor.toFixed(2)}</span>
            </div>
            <div
              aria-hidden
              className={`rounded-full bg-slate-200/80 dark:bg-slate-800 ${destaque ? "h-2.5" : "h-1.5"}`}
            >
              <div
                className={`h-full rounded-full ${COR_BARRA[n]}`}
                style={{ width: `${Math.round(valor * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Só os eixos que passaram do limite de revisão, como chips - para listas
// longas (histórico), onde sete barras por linha afogariam a página. O
// detalhe completo fica um clique adiante (PontuacoesIA dentro de <details>).
export function ChipsPontuacao({
  itens,
  vazio,
}: {
  itens: Pontuacao[];
  vazio: string;
}) {
  const alertas = itens.flatMap(({ rotulo, valor, invertido = false }) => {
    if (typeof valor !== "number") return [];
    const n = nivel(valor, invertido);
    return n === "ok" ? [] : [{ rotulo, valor, n }];
  });

  if (alertas.length === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">{vazio}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {alertas.map(({ rotulo, valor, n }) => (
        <li
          key={rotulo}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
            n === "alto"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
              : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
          }`}
        >
          {rotulo}
          <span className="font-mono tabular-nums">{valor.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
