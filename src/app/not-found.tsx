import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { botaoPrimario, botaoSecundario, containerSite } from "@/lib/estilos";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="relative flex flex-1 flex-col justify-center overflow-hidden">
      <div aria-hidden className="bg-planta pointer-events-none absolute inset-0 -z-10" />

      <div className={`${containerSite} flex flex-col items-start gap-8 py-20`}>
        {/* Placa de "rua sem saída": o código é o elemento, não um ícone solto. */}
        <p
          aria-hidden
          className="-rotate-2 rounded-lg border-4 border-ink bg-signal px-6 py-2 font-mono text-6xl font-medium text-on-signal sm:text-8xl"
        >
          404
        </p>

        <div className="flex max-w-lg flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {t("titulo")}
          </h1>
          <p className="text-lg text-ink-muted">{t("descricao")}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/" className={botaoPrimario}>
            {t("voltarInicio")}
          </Link>
          <Link href="/reclamacoes" className={botaoSecundario}>
            {t("verReclamacoes")}
          </Link>
        </div>
      </div>
    </main>
  );
}
