import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

const TONS = {
  erro: {
    caixa: "border-danger-ink/30 bg-danger-soft text-danger-ink",
    icone: CircleAlert,
  },
  atencao: {
    caixa: "border-warn-ink/30 bg-warn-soft text-warn-ink",
    icone: TriangleAlert,
  },
  info: {
    caixa: "border-line bg-sunken/70 text-ink-2",
    icone: Info,
  },
} as const;

// Aviso em linha, com ícone: o tom (erro/atenção/info) é dado pelo ícone E
// pela cor - nunca só pela cor. Substitui os <p> soltos em vermelho/âmbar.
export function Aviso({
  tom = "info",
  acao,
  children,
}: {
  tom?: keyof typeof TONS;
  // Botão/link opcional, à direita (embaixo em tela estreita). Fica fora do
  // bloco ícone + texto, pra o ícone acompanhar a PRIMEIRA linha do texto em
  // vez de se alinhar ao topo de uma caixa que o botão deixou mais alta.
  acao?: ReactNode;
  children: ReactNode;
}) {
  const { caixa, icone: Icone } = TONS[tom];

  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border px-3.5 py-3 text-sm ${caixa}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">{children}</div>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
