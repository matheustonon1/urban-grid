import Link from "next/link";
import { useTranslations } from "next-intl";

import { botaoSecundario } from "@/lib/estilos";

export function Paginacao({
  paginaAtual,
  totalPaginas,
  basePath,
  paramName = "page",
  searchParams,
}: {
  paginaAtual: number;
  totalPaginas: number;
  basePath: string;
  paramName?: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const t = useTranslations("Paginacao");

  if (totalPaginas <= 1) {
    return null;
  }

  function href(pagina: number) {
    const params = new URLSearchParams();
    for (const [chave, valor] of Object.entries(searchParams ?? {})) {
      if (valor) params.set(chave, valor);
    }
    if (pagina > 1) params.set(paramName, String(pagina));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <nav className="flex items-center justify-between gap-3 pt-2" aria-label={t("navegacao")}>
      {paginaAtual > 1 ? (
        <Link href={href(paginaAtual - 1)} className={botaoSecundario}>
          {t("anterior")}
        </Link>
      ) : (
        <span />
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("pagina", { atual: paginaAtual, total: totalPaginas })}
      </p>

      {paginaAtual < totalPaginas ? (
        <Link href={href(paginaAtual + 1)} className={botaoSecundario}>
          {t("proxima")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
