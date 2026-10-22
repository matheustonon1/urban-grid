import { getTranslations } from "next-intl/server";
import { Rss } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { colunaLateral, colunaPrincipal, grade, pagina } from "@/lib/estilos";
import { exigirSessao } from "@/lib/seguranca/sessao";
import { metadataDaPagina } from "@/lib/metadata";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { BotaoAcao, FormularioAcao } from "@/components/ui/formulario-acao";
import { Secao } from "@/components/ui/secao";

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
    <main className={pagina}>
      <CabecalhoPagina kicker={t("kicker")} titulo={t("titulo")} descricao={t("subtitulo")} />

      <div className={grade}>
        <aside className={`${colunaLateral} lg:order-last`}>
          <FormularioNovaAssinatura categorias={categoriasAtivas} />
        </aside>

        <div className={colunaPrincipal}>
          <Secao id="assinaturas" titulo={t("suasAssinaturas")} contador={assinaturas.length}>
            {assinaturas.length === 0 && <EstadoVazio icone={Rss} titulo={t("nenhumaAssinatura")} />}

            {assinaturas.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {assinaturas.map((assinatura) => (
                  <li key={assinatura.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-bold text-ink">
                        {assinatura.cidade.nome} - {assinatura.cidade.estado.uf}
                      </span>
                      <span className="text-sm text-ink-muted">
                        {assinatura.categoria?.nome ?? t("todasCategorias")}
                      </span>
                    </div>
                    <FormularioAcao action={cancelarAssinatura.bind(null, assinatura.id)}>
                      <BotaoAcao className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-semibold text-danger-ink hover:bg-danger-soft disabled:opacity-60">
                        {t("cancelar")}
                      </BotaoAcao>
                    </FormularioAcao>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>
    </main>
  );
}
