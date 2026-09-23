import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { linkSutil } from "@/lib/estilos";

import { FormularioEsqueciSenha } from "./formulario";

export default async function EsqueciSenhaPage() {
  const t = await getTranslations("EsqueciSenha");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8">
      <div
        aria-hidden
        className="animate-grid-drift bg-dot-grid pointer-events-none absolute inset-0 -z-20"
      />
      <div
        aria-hidden
        className="animate-float pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-blue-500/10"
      />

      <div className="animate-fade-in flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("titulo")}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("subtitulo")}</p>
        </div>

        <FormularioEsqueciSenha />

        <Link href="/login" className={linkSutil}>
          {t("voltarLogin")}
        </Link>
      </div>
    </main>
  );
}
