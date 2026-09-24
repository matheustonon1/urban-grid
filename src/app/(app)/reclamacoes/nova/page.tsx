import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { containerPagina } from "@/lib/estilos";

import { NovaReclamacaoForm } from "./form";

export default async function NovaReclamacaoPage() {
  const t = await getTranslations("NovaReclamacao");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

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
