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
      className="inline-flex rounded-lg border border-slate-200 bg-slate-100/70 p-0.5 dark:border-slate-800 dark:bg-slate-900"
    >
      {PERIODOS.map(({ chave }) => {
        const ativo = chave === atual;
        return (
          <Link
            key={chave}
            href={`/moderacao/estatisticas?dias=${chave}`}
            aria-current={ativo ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
              ativo
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {t(ROTULOS[chave])}
          </Link>
        );
      })}
    </nav>
  );
}
