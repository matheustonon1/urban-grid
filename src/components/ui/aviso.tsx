import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

// Exportado: o aviso flutuante (avisos.tsx) usa a mesma cor e o mesmo ícone por
// tom, então um sucesso parece o mesmo sucesso dentro de um formulário ou no canto
// da tela.
export const TONS_AVISO = {
  sucesso: {
    caixa: "border-ok-ink/30 bg-ok-soft text-ok-ink",
    icone: CircleCheck,
  },
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

export type TomAviso = keyof typeof TONS_AVISO;

// Aviso em linha, com ícone: o tom (sucesso/erro/atenção/info) é dado pelo ícone E
// pela cor - nunca só pela cor. Substitui os <p> soltos em vermelho/âmbar.
// Erro anuncia como alerta; sucesso e info, como status (leitor de tela lê sem
// interromper o que a pessoa estava lendo).
export function Aviso({
  tom = "info",
  acao,
  children,
}: {
  tom?: TomAviso;
  // Botão/link opcional, à direita (embaixo em tela estreita). Fica fora do
  // bloco ícone + texto, pra o ícone acompanhar a PRIMEIRA linha do texto em
  // vez de se alinhar ao topo de uma caixa que o botão deixou mais alta.
  acao?: ReactNode;
  children: ReactNode;
}) {
  const { caixa, icone: Icone } = TONS_AVISO[tom];

  return (
    <div
      role={tom === "erro" ? "alert" : tom === "sucesso" ? "status" : undefined}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border px-3.5 py-3 text-sm ${caixa}`}
    >
      {/* Base de 14rem (e não 0, como no `flex-1`): sem ela o texto nunca "não cabe" e o
          flex-wrap não leva a ação para baixo - o botão espremia o texto numa coluna de
          uma palavra por linha em tela estreita e dentro de diálogo. */}
      <div className="flex min-w-0 flex-[1_1_14rem] items-start gap-2.5">
        <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0">{children}</div>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
