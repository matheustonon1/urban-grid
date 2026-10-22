import { getTranslations } from "next-intl/server";
import { Rss } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { cartao, containerPagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { cancelarAssinatura } from "./actions";
import { FormularioNovaAssinatura } from "./formulario";

export const generateMetadata = metadataDaPagina("Assinaturas");

export default async function AssinaturasPage() {
  const t = await getTranslations("Assinaturas");
  const session = await exigirSessao();

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
      <CabecalhoPagina titulo={t("titulo")} descricao={t("subtitulo")} />

      <FormularioNovaAssinatura categorias={categoriasAtivas} />

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold text-ink">{t("suasAssinaturas")}</h2>

        {assinaturas.length === 0 && (
          <EstadoVazio icone={Rss} titulo={t("nenhumaAssinatura")} />
        )}

        {assinaturas.length > 0 && (
          <ul className={`divide-y divide-line overflow-hidden p-0 ${cartao}`}>
            {assinaturas.map((assinatura) => (
              <li key={assinatura.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-ink">
                    {assinatura.cidade.nome} - {assinatura.cidade.estado.uf}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {assinatura.categoria?.nome ?? t("todasCategorias")}
                  </span>
                </div>
                <form action={cancelarAssinatura.bind(null, assinatura.id)}>
                  <button type="submit" className="rounded-md px-2 py-1 text-sm font-medium text-danger-ink hover:bg-danger-soft/40">
                    {t("cancelar")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
