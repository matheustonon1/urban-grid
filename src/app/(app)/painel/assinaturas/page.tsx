import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cartao, containerPagina } from "@/lib/estilos";

import { cancelarAssinatura } from "./actions";
import { FormularioNovaAssinatura } from "./formulario";

export default async function AssinaturasPage() {
  const t = await getTranslations("Assinaturas");
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [assinaturas, categoriasAtivas] = await Promise.all([
    prisma.assinaturaCidade.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        cidade: { select: { nome: true, estado: { select: { uf: true } } } },
        categoria: { select: { nome: true } },
      },
    }),
    prisma.categoria.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
  ]);

  return (
    <main className={containerPagina}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("subtitulo")}</p>
      </div>

      <FormularioNovaAssinatura categorias={categoriasAtivas} />

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{t("suasAssinaturas")}</h2>

        {assinaturas.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaAssinatura")}</p>
        )}

        {assinaturas.map((assinatura) => (
          <div key={assinatura.id} className={`flex items-center justify-between gap-3 ${cartao}`}>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {assinatura.cidade.nome} - {assinatura.cidade.estado.uf}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {assinatura.categoria?.nome ?? t("todasCategorias")}
              </span>
            </div>
            <form action={cancelarAssinatura.bind(null, assinatura.id)}>
              <button
                type="submit"
                className="text-sm text-red-600 hover:underline dark:text-red-400"
              >
                {t("cancelar")}
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
