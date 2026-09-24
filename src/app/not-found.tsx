import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { botaoPrimario, botaoSecundario } from "@/lib/estilos";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="animate-grid-drift bg-dot-grid pointer-events-none absolute inset-0 -z-20"
      />
      <div
        aria-hidden
        className="animate-float pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-blue-500/10"
      />

      <MapPinOff className="h-12 w-12 text-primary" aria-hidden />

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t("descricao")}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={botaoPrimario}>
          {t("voltarInicio")}
        </Link>
        <Link href="/reclamacoes" className={botaoSecundario}>
          {t("verReclamacoes")}
        </Link>
      </div>
    </main>
  );
}
