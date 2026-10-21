import { Database, Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { botaoSecundario, cartao } from "@/lib/estilos";

export async function ExportarDados() {
  const t = await getTranslations("Conta");

  return (
    <section className={`flex flex-col gap-3 ${cartao}`}>
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          {t("privacidadeDados")}
        </h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("exportarDadosDesc")}</p>
      {/* <a>, não <Link>: é um download, e o Link pré-carregaria a rota (gerando o arquivo à toa). */}
      <a href="/painel/conta/exportar" download className={`${botaoSecundario} w-fit`}>
        <Download className="h-4 w-4" aria-hidden />
        {t("baixarMeusDados")}
      </a>
    </section>
  );
}
