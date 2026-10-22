import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/ui/paginacao";
import { ResumoLateral } from "@/components/ui/resumo-lateral";
import { Secao } from "@/components/ui/secao";
import { botaoSecundario, colunaLateral, colunaPrincipal, grade, pagina } from "@/lib/estilos";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { metadataDaPagina } from "@/lib/metadata";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { AvatarIniciais } from "@/components/ui/avatar-iniciais";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { formatarDataHora } from "@/lib/util/formatarData";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";
import { reverterBanimento } from "./actions";

// "Permanente" (100 anos, ver DIAS_BANIMENTO em denuncias/actions.ts) não
// tem um valor especial no banco - só uma data muito distante. Detecta
// isso aqui só pra mostrar um rótulo melhor do que uma data em 2126.
const LIMIAR_PERMANENTE_MS = 50 * 365 * 24 * 60 * 60 * 1000;

export const generateMetadata = metadataDaPagina("Banimentos");

export default async function BanimentosPage({ searchParams }: PageProps<"/banimentos">) {
  const t = await getTranslations("Banimentos");
  const tNav = await getTranslations("AdminNav");
  const locale = await getLocale();
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const agora = new Date();
  const filtro = { banidoAte: { gt: agora } };

  const [banidos, totalBanidos, totalPermanentes] = await Promise.all([
    prisma.user.findMany({
      where: filtro,
      orderBy: { banidoAte: "asc" },
      select: { id: true, name: true, email: true, banidoAte: true },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.user.count({ where: filtro }),
    prisma.user.count({ where: { banidoAte: { gt: new Date(agora.getTime() + LIMIAR_PERMANENTE_MS) } } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalBanidos);

  return (
    <main className={pagina}>
      <CabecalhoPagina
        kicker={tNav("kickerAdmin")}
        titulo={t("titulo")}
        descricao={t("descricao")}
      />

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="banidos" titulo={t("secaoContas")}>
            {banidos.length === 0 && <EstadoVazio icone={CircleCheck} titulo={t("nenhumBanido")} />}

            {banidos.length > 0 && (
              <ul className="-mt-2 divide-y divide-line">
                {banidos.map((usuario) => {
                  const permanente =
                    usuario.banidoAte!.getTime() - agora.getTime() > LIMIAR_PERMANENTE_MS;

                  return (
                    <li
                      key={usuario.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <AvatarIniciais nome={usuario.name ?? usuario.email} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{usuario.name ?? usuario.email}</p>
                        <p className="text-sm text-ink-muted">
                          {permanente
                            ? t("banidoPermanente")
                            : t("banidoAte", { data: formatarDataHora(usuario.banidoAte!, locale) })}
                        </p>
                      </div>

                      <form action={reverterBanimento.bind(null, usuario.id)}>
                        <button type="submit" className={botaoSecundario}>
                          {t("reverter")}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/banimentos" />
          </Secao>
        </div>

        <aside className={colunaLateral}>
          <ResumoLateral
            rotulo={t("secaoContas")}
            valor={totalBanidos}
            itens={[{ rotulo: t("resumoPermanentes"), valor: totalPermanentes }]}
          />
        </aside>
      </div>
    </main>
  );
}
