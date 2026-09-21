"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ServerCrash } from "lucide-react";

import { botaoPrimario, botaoSecundario } from "@/lib/estilos";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="animate-grid-drift bg-dot-grid pointer-events-none absolute inset-0 -z-20"
      />

      <ServerCrash className="h-12 w-12 text-red-600 dark:text-red-400" aria-hidden />

      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Algo deu errado
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Um erro inesperado aconteceu. Você pode tentar de novo, ou voltar
          ao início se o problema persistir.
          {error.digest && (
            <>
              {" "}
              Código de referência: <code className="font-mono">{error.digest}</code>.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={botaoPrimario}>
          Tentar de novo
        </button>
        <Link href="/" className={botaoSecundario}>
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
