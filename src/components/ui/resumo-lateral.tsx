import type { ReactNode } from "react";

import { cartaoSecao } from "@/lib/estilos";

// Lateral das telas de fila e de lista da moderação/administração: o número que
// importa em tamanho de placa (quantos itens esperam) e, abaixo, a quebra desse
// número em linhas de rótulo + valor. Fica na coluna de 4/12 ao lado da lista.
export function ResumoLateral({
  rotulo,
  valor,
  itens,
  children,
}: {
  rotulo: string;
  valor: number | string;
  itens?: { rotulo: string; valor: number | string }[];
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-5 ${cartaoSecao}`}>
      <div className="flex flex-col gap-2">
        <span className="kicker">{rotulo}</span>
        <span className="font-mono text-5xl leading-none font-medium text-ink tabular-nums">
          {valor}
        </span>
      </div>

      {itens && itens.length > 0 && (
        <dl className="flex flex-col divide-y divide-line">
          {itens.map((item) => (
            <div key={item.rotulo} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-ink-muted">{item.rotulo}</dt>
              <dd className="font-mono text-lg font-medium text-ink tabular-nums">{item.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}
    </div>
  );
}
