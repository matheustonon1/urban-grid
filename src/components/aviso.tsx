import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

const TONS = {
  erro: {
    caixa:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
    icone: CircleAlert,
  },
  atencao: {
    caixa:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    icone: TriangleAlert,
  },
  info: {
    caixa:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
    icone: Info,
  },
} as const;

// Aviso em linha, com ícone: o tom (erro/atenção/info) é dado pelo ícone E
// pela cor - nunca só pela cor. Substitui os <p> soltos em vermelho/âmbar.
export function Aviso({
  tom = "info",
  children,
}: {
  tom?: keyof typeof TONS;
  children: ReactNode;
}) {
  const { caixa, icone: Icone } = TONS[tom];

  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${caixa}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
