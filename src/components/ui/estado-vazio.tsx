import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Estado vazio com desenho próprio (antes era uma linha de texto solta no
// meio de uma tela inteira). Borda tracejada + fundo translúcido = "aqui
// ainda não tem nada", sem competir com os cartões de conteúdo de verdade.
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Icone className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display font-semibold text-slate-900 dark:text-slate-100">{titulo}</p>
        {descricao && <p className="text-sm text-slate-500 dark:text-slate-400">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}
