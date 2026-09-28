import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { containerPagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/sessao";

import { NovaReclamacaoForm } from "./form";

export default async function NovaReclamacaoPage() {
  const t = await getTranslations("NovaReclamacao");
  await exigirSessao();

  const categorias = await prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
  });

  return (
    <main className={`${containerPagina} max-w-xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("tituloPagina")}
      </h1>
      <NovaReclamacaoForm categorias={categorias} />
    </main>
  );
}
