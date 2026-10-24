import Link from "next/link";
import { useTranslations } from "next-intl";

import { PERIODOS, type ChavePeriodo } from "@/lib/moderacao/estatisticas";

const ROTULOS: Record<ChavePeriodo, "periodo7" | "periodo30" | "periodo90" | "periodoTodos"> = {
  "7": "periodo7",
  "30": "periodo30",
  "90": "periodo90",
  todos: "periodoTodos",
};

// Controle segmentado feito de links: o período vive na URL (?dias=), então
// dá pra compartilhar a visão e o botão "voltar" funciona. Sem JS no cliente.
export function SeletorPeriodo({ atual }: { atual: ChavePeriodo }) {
  const t = useTranslations("Estatisticas");
  return (
    <nav
      aria-label={t("periodoRotulo")}
      className="inline-flex rounded-md border border-line-strong bg-surface p-0.5"
    >
      {PERIODOS.map(({ chave }) => {
        const ativo = chave === atual;
        return (
          <Link
            key={chave}
            href={`/moderacao/estatisticas?dias=${chave}`}
            aria-current={ativo ? "true" : undefined}
            className={`rounded-[5px] px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
              ativo
                ? "bg-ink text-paper"
                : "text-ink-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            {t(ROTULOS[chave])}
          </Link>
        );
      })}
    </nav>
  );
}
