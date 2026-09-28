import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";

import { aprovarSolicitacaoCidade, rejeitarSolicitacaoCidade } from "./actions";
import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";

const STATUS_COR: Record<string, string> = {
  APROVADA: "text-green-700 dark:text-green-400",
  REJEITADA: "text-red-700 dark:text-red-400",
};

export default async function SolicitacoesCidadePage({
  searchParams,
}: PageProps<"/solicitacoes-cidade">) {
  const t = await getTranslations("SolicitacoesCidade");
  const locale = await getLocale();
  await exigirAdmin();

  const { pagePendentes, pageDecididas } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaDecididas = lerPaginaAtual(pageDecididas);
  const filtroDecididas = { status: { not: "PENDENTE" as const } };

  const [pendentes, totalPendentes, decididasRecentemente, totalDecididas] = await Promise.all([
    prisma.solicitacaoCidade.findMany({
      where: { status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      skip: calcularSkip(paginaPendentes),
      take: ITENS_POR_PAGINA,
    }),
    prisma.solicitacaoCidade.count({ where: { status: "PENDENTE" } }),
    prisma.solicitacaoCidade.findMany({
      where: filtroDecididas,
      orderBy: { analisadoEm: "desc" },
      skip: calcularSkip(paginaDecididas),
      take: ITENS_POR_PAGINA,
      include: { analisadoPor: true },
    }),
    prisma.solicitacaoCidade.count({ where: filtroDecididas }),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasDecididas = calcularTotalPaginas(totalDecididas);

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("titulo")}
      </h1>

      {pendentes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaPendente")}</p>
      )}

      {pendentes.map((solicitacao) => (
        <div key={solicitacao.id} className={`flex flex-col gap-2 ${cartao}`}>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {solicitacao.nomeCidade} - {solicitacao.uf}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("solicitadoPor")} {solicitacao.nomeSolicitante} · {solicitacao.email}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t("enviadoEm")} {solicitacao.createdAt.toLocaleString(locale)}
          </p>

          <div className="flex flex-wrap items-start gap-2">
            <form
              action={aprovarSolicitacaoCidade.bind(null, solicitacao.id)}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                name="codigoIbge"
                required
                pattern="\d{7}"
                title={t("codigoIbgeAjuda")}
                placeholder={t("codigoIbgePlaceholder")}
                className={`w-36 ${campoInput}`}
              />
              <button type="submit" className={botaoPrimario}>
                {t("aprovar")}
              </button>
            </form>

            <form
              action={rejeitarSolicitacaoCidade.bind(null, solicitacao.id)}
              className="flex flex-1 gap-2"
            >
              <textarea
                name="motivo"
                required
                minLength={10}
                placeholder={t("motivoRejeicaoPlaceholder")}
                rows={1}
                className={`flex-1 ${campoInput}`}
              />
              <button type="submit" className={botaoSecundario}>
                {t("rejeitar")}
              </button>
            </form>
          </div>
        </div>
      ))}

      <Paginacao
        paginaAtual={paginaPendentes}
        totalPaginas={totalPaginasPendentes}
        basePath="/solicitacoes-cidade"
        paramName="pagePendentes"
        searchParams={{
          pageDecididas: typeof pageDecididas === "string" ? pageDecididas : undefined,
        }}
      />

      {decididasRecentemente.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("decididasRecentemente")} {totalDecididas > 0 && `(${totalDecididas})`}
          </h2>
          {decididasRecentemente.map((solicitacao) => (
            <div key={solicitacao.id} className={`flex flex-col gap-1 ${cartao}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {solicitacao.nomeCidade} - {solicitacao.uf}
                </p>
                <span className={`text-sm font-medium ${STATUS_COR[solicitacao.status]}`}>
                  {solicitacao.status === "APROVADA" ? t("aprovada") : t("rejeitada")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {solicitacao.email} · {t("por")}{" "}
                {solicitacao.analisadoPor?.name ?? solicitacao.analisadoPor?.email ?? "—"} {t("em")}{" "}
                {solicitacao.analisadoEm?.toLocaleString(locale)}
              </p>
              {solicitacao.motivoRejeicao && (
                <p className="text-sm italic text-slate-600 dark:text-slate-400">
                  “{solicitacao.motivoRejeicao}”
                </p>
              )}
            </div>
          ))}

          <Paginacao
            paginaAtual={paginaDecididas}
            totalPaginas={totalPaginasDecididas}
            basePath="/solicitacoes-cidade"
            paramName="pageDecididas"
            searchParams={{
              pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
            }}
          />
        </div>
      )}
    </main>
  );
}
