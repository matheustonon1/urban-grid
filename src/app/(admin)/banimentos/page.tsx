import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { botaoSecundario, cartao, containerPagina } from "@/lib/estilos";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";
import { reverterBanimento } from "./actions";

// "Permanente" (100 anos, ver DIAS_BANIMENTO em denuncias/actions.ts) não
// tem um valor especial no banco - só uma data muito distante. Detecta
// isso aqui só pra mostrar um rótulo melhor do que uma data em 2126.
const LIMIAR_PERMANENTE_MS = 50 * 365 * 24 * 60 * 60 * 1000;

export default async function BanimentosPage({ searchParams }: PageProps<"/banimentos">) {
  const t = await getTranslations("Banimentos");
  const locale = await getLocale();
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const agora = new Date();
  const filtro = { banidoAte: { gt: agora } };

  const [banidos, totalBanidos] = await Promise.all([
    prisma.user.findMany({
      where: filtro,
      orderBy: { banidoAte: "asc" },
      select: { id: true, name: true, email: true, banidoAte: true },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.user.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalBanidos);

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")} {totalBanidos > 0 && `(${totalBanidos})`}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("descricao")}</p>
      </div>

      {banidos.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumBanido")}</p>
      )}

      {banidos.map((usuario) => {
        const permanente =
          usuario.banidoAte!.getTime() - agora.getTime() > LIMIAR_PERMANENTE_MS;

        return (
          <div
            key={usuario.id}
            className={`flex flex-wrap items-center justify-between gap-3 ${cartao}`}
          >
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {usuario.name ?? usuario.email}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {permanente
                  ? t("banidoPermanente")
                  : t("banidoAte", { data: usuario.banidoAte!.toLocaleString(locale) })}
              </p>
            </div>

            <form action={reverterBanimento.bind(null, usuario.id)}>
              <button type="submit" className={botaoSecundario}>
                {t("reverter")}
              </button>
            </form>
          </div>
        );
      })}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/banimentos" />
    </main>
  );
}
