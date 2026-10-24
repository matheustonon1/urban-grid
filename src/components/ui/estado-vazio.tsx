import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Estado vazio com desenho próprio. Borda tracejada = "aqui ainda não tem
// nada", sem competir com os cartões de conteúdo de verdade. O ícone vai num
// quadrado de cantos curtos, a mesma família da marca.
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
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-sunken text-ink-muted">
        <Icone className="h-5 w-5" aria-hidden />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-base font-bold text-ink">{titulo}</p>
        {descricao && <p className="text-sm text-ink-muted">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}
