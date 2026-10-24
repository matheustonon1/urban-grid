"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { botaoPrimario, botaoSecundario, containerSite } from "@/lib/estilos";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("ErrorBoundary");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex flex-1 flex-col justify-center overflow-hidden">
      <div aria-hidden className="bg-planta pointer-events-none absolute inset-0 -z-10" />

      <div className={`${containerSite} flex flex-col items-start gap-8 py-20`}>
        <p
          aria-hidden
          className="rotate-2 rounded-lg border-4 border-ink bg-signal px-6 py-2 font-mono text-6xl font-medium text-on-signal sm:text-8xl"
        >
          500
        </p>

        <div className="flex max-w-lg flex-col gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            {t("titulo")}
          </h1>
          <p className="text-lg text-ink-muted">
            {t("descricao")}
            {error.digest && (
              <>
                {" "}
                {t("codigoReferencia")} <code className="font-mono">{error.digest}</code>.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={botaoPrimario}>
            {t("tentarDeNovo")}
          </button>
          <Link href="/" className={botaoSecundario}>
            {t("voltarInicio")}
          </Link>
        </div>
      </div>
    </main>
  );
}
