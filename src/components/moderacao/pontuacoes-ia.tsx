// Pontuações da moderação por IA, uma barra por eixo, para o moderador
// bater o olho no que motivou o encaminhamento. Os cortes são os do próprio
// pipeline (lib/moderacao/pontuacoes, usado por decidir() em lib/moderacao): >= 0,75
// reprova, >= 0,4 manda pra revisão humana - antes eram cinco linhas de texto
// com o mesmo peso, e o eixo que causou o alerta se perdia entre os normais.
import { nivelPontuacao as nivel } from "@/lib/moderacao/pontuacoes";

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

const COR_BARRA = {
  ok: "bg-ink-faint",
  atencao: "bg-warn-ink",
  alto: "bg-danger-ink",
} as const;

const COR_VALOR = {
  ok: "text-ink-muted",
  atencao: "font-semibold text-warn-ink",
  alto: "font-semibold text-danger-ink",
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
              <span className="text-ink-2">{rotulo}</span>
              <span className={`font-mono tabular-nums ${COR_VALOR[n]}`}>{valor.toFixed(2)}</span>
            </div>
            <div
              aria-hidden
              className={`rounded-full bg-sunken ${destaque ? "h-2.5" : "h-1.5"}`}
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
    return <p className="text-xs text-ink-muted">{vazio}</p>;
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {alertas.map(({ rotulo, valor, n }) => (
        <li
          key={rotulo}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${
            n === "alto"
              ? "bg-danger-soft text-danger-ink"
              : "bg-warn-soft text-warn-ink"
          }`}
        >
          {rotulo}
          <span className="font-mono tabular-nums">{valor.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}
