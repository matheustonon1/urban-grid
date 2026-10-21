import type { ReactNode } from "react";

const TONS = {
  sucesso: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  erro: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  atencao: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  neutro: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
} as const;

// Pílula pequena com ponto de cor: o rótulo (texto) sempre acompanha o tom.
// Mesma linguagem do StatusBadge e do DecisaoBadge, pra estados que não são
// de reclamação nem de decisão da IA (aprovada/rejeitada, inativo, papel...).
export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: keyof typeof TONS;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONS[tom]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
