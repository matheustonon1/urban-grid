import Link from "next/link";
import { MapPinOff } from "lucide-react";

import { botaoPrimario, botaoSecundario } from "@/lib/estilos";

export default function NotFound() {
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
          Página não encontrada
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          O endereço que você tentou acessar não existe ou foi removido.
          Talvez o link esteja incorreto ou a página tenha mudado de lugar.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className={botaoPrimario}>
          Voltar ao início
        </Link>
        <Link href="/reclamacoes" className={botaoSecundario}>
          Ver reclamações públicas
        </Link>
      </div>
    </main>
  );
}
