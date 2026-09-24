import { getTranslations } from "next-intl/server";

import { TermosConteudo } from "@/components/termos-conteudo";
import { containerPagina } from "@/lib/estilos";

export default async function TermosPage() {
  const t = await getTranslations("Footer");

  return (
    <main className={`${containerPagina} max-w-2xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("termos")}
      </h1>

      <TermosConteudo />
    </main>
  );
}
