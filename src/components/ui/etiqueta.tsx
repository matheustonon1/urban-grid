import type { ReactNode } from "react";

const TONS = {
  sucesso: "bg-ok-soft text-ok-ink",
  erro: "bg-danger-soft text-danger-ink",
  atencao: "bg-warn-soft text-warn-ink",
  andamento: "bg-progress-soft text-progress-ink",
  info: "bg-brand-soft text-brand-ink",
  neutro: "bg-sunken text-ink-2",
  apagado: "bg-sunken text-ink-muted",
} as const;

export type TomEtiqueta = keyof typeof TONS;

// Etiqueta de estado: retângulo de cantos curtos (como placa) com um quadradinho
// de cor antes do texto. O rótulo sempre acompanha o tom - cor nunca é a única
// portadora do estado. Base do StatusBadge, do DecisaoBadge e do Selo.
export function Etiqueta({
  tom = "neutro",
  children,
}: {
  tom?: TomEtiqueta;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap ${TONS[tom]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-[1px] bg-current" />
      {children}
    </span>
  );
}
