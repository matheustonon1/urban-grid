import { useTranslations } from "next-intl";

import { cartao } from "@/lib/estilos";

export function TermosConteudo() {
  const t = useTranslations("Termos");

  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col gap-2 ${cartao}`}>
        <p className="text-sm text-amber-700 dark:text-amber-400">{t("aviso")}</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("secao1Titulo")}
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("secao1Paragrafo1")}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("secao1Paragrafo2")}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("secao2Titulo")}
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("secao2Paragrafo1")}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("secao2Paragrafo2")}</p>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t("secao2Paragrafo3")}</p>
      </section>
    </div>
  );
}
