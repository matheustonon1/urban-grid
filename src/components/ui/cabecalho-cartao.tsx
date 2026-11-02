import type { LucideIcon } from "lucide-react";

const TONS = {
  neutro: { fundo: "bg-sunken text-ink-2", titulo: "text-ink" },
  marca: { fundo: "bg-brand-soft text-brand-ink", titulo: "text-ink" },
  ok: { fundo: "bg-ok-soft text-ok-ink", titulo: "text-ink" },
  perigo: { fundo: "bg-danger-soft text-danger-ink", titulo: "text-danger-ink" },
} as const;

// Título de um bloco de formulário/cartão (Minha conta, painel do órgão...):
// o ícone vai num quadrado de cantos curtos - a mesma família da marca - e o
// título é um h3 (o h2 é o da Secao que agrupa os blocos).
export function CabecalhoCartao({
  icone: Icone,
  titulo,
  tom = "neutro",
}: {
  icone: LucideIcon;
  titulo: string;
  tom?: keyof typeof TONS;
}) {
  const { fundo, titulo: corTitulo } = TONS[tom];

  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${fundo}`}>
        <Icone className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <h3 className={`text-lg leading-tight font-extrabold tracking-tight ${corTitulo}`}>{titulo}</h3>
    </div>
  );
}
