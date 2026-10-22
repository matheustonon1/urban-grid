import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { botaoPerigo, botaoPrimario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { metadataDaPagina } from "@/lib/metadata";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/util/formatarData";

import { aprovarSolicitacao, rejeitarSolicitacao } from "./actions";
import { exigirAdmin } from "./exigir-admin";

export const generateMetadata = metadataDaPagina("SolicitacoesOrgao");

export default async function SolicitacoesOrgaoPage({
  searchParams,
}: PageProps<"/solicitacoes-orgao">) {
  const t = await getTranslations("SolicitacoesOrgao");
  const locale = await getLocale();
  await exigirAdmin();

  const { pagePendentes, pageDecididas } = await searchParams;
  const paginaPendentes = lerPaginaAtual(pagePendentes);
  const paginaDecididas = lerPaginaAtual(pageDecididas);
  const filtroDecididas = { status: { not: "PENDENTE" as const } };

  const [pendentes, totalPendentes, decididasRecentemente, totalDecididas] = await Promise.all([
    prisma.solicitacaoOrgao.findMany({
      where: { status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      include: { cidade: { include: { estado: true } } },
      skip: calcularSkip(paginaPendentes),
      take: ITENS_POR_PAGINA,
    }),
    prisma.solicitacaoOrgao.count({ where: { status: "PENDENTE" } }),
    prisma.solicitacaoOrgao.findMany({
      where: filtroDecididas,
      orderBy: { analisadoEm: "desc" },
      skip: calcularSkip(paginaDecididas),
      take: ITENS_POR_PAGINA,
      include: { cidade: true, analisadoPor: true },
    }),
    prisma.solicitacaoOrgao.count({ where: filtroDecididas }),
  ]);
  const totalPaginasPendentes = calcularTotalPaginas(totalPendentes);
  const totalPaginasDecididas = calcularTotalPaginas(totalDecididas);

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={t("resumoPendentes", { count: totalPendentes })}
      />

      {pendentes.length === 0 && (
        <EstadoVazio icone={CircleCheck} titulo={t("nenhumaPendente")} />
      )}

      {pendentes.map((solicitacao) => (
        <div key={solicitacao.id} className={`flex flex-col gap-2 ${cartao}`}>
          <p className="font-medium text-ink">
            {solicitacao.nomeOrgao}
            {solicitacao.sigla && ` (${solicitacao.sigla})`}
          </p>
          <p className="text-sm text-ink-muted">
            {solicitacao.cidade.nome} - {solicitacao.cidade.estado.uf}
          </p>
          <p className="text-sm text-ink-muted">
            {t("responsavel")} {solicitacao.nomeResponsavel} · {solicitacao.email}
            {solicitacao.telefone && ` · ${solicitacao.telefone}`}
          </p>
          <p className="text-xs text-ink-muted">
            {t("enviadoEm")} {formatarDataHora(solicitacao.createdAt, locale)}
          </p>

          <div className="flex flex-wrap items-start gap-2">
            <form action={aprovarSolicitacao.bind(null, solicitacao.id)}>
              <button type="submit" className={botaoPrimario}>
                {t("aprovar")}
              </button>
            </form>

            <form
              action={rejeitarSolicitacao.bind(null, solicitacao.id)}
              className="flex min-w-0 basis-full gap-2 sm:flex-1 sm:basis-0"
            >
              <textarea
                name="motivo"
                required
                minLength={10}
                placeholder={t("motivoRejeicaoPlaceholder")}
                rows={1}
                className={`flex-1 ${campoInput}`}
              />
              <button type="submit" className={botaoPerigo}>
                {t("rejeitar")}
              </button>
            </form>
          </div>
        </div>
      ))}

      <Paginacao
        paginaAtual={paginaPendentes}
        totalPaginas={totalPaginasPendentes}
        basePath="/solicitacoes-orgao"
        paramName="pagePendentes"
        searchParams={{
          pageDecididas: typeof pageDecididas === "string" ? pageDecididas : undefined,
        }}
      />

      {decididasRecentemente.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-ink">
            {t("decididasRecentemente")} {totalDecididas > 0 && `(${totalDecididas})`}
          </h2>
          {decididasRecentemente.map((solicitacao) => (
            <div key={solicitacao.id} className={`flex flex-col gap-1 ${cartao}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-ink">
                  {solicitacao.nomeOrgao}
                  {solicitacao.sigla && ` (${solicitacao.sigla})`} · {solicitacao.cidade.nome}
                </p>
                <Selo tom={solicitacao.status === "APROVADA" ? "sucesso" : "erro"}>
                  {solicitacao.status === "APROVADA" ? t("aprovada") : t("rejeitada")}
                </Selo>
              </div>
              <p className="text-xs text-ink-muted">
                {solicitacao.email} · {t("por")}{" "}
                {solicitacao.analisadoPor?.name ?? solicitacao.analisadoPor?.email ?? "—"} {t("em")}{" "}
                {solicitacao.analisadoEm ? formatarDataHora(solicitacao.analisadoEm, locale) : "—"}
              </p>
              {solicitacao.motivoRejeicao && (
                <p className="text-sm italic text-ink-muted">
                  “{solicitacao.motivoRejeicao}”
                </p>
              )}
            </div>
          ))}

          <Paginacao
            paginaAtual={paginaDecididas}
            totalPaginas={totalPaginasDecididas}
            basePath="/solicitacoes-orgao"
            paramName="pageDecididas"
            searchParams={{
              pagePendentes: typeof pagePendentes === "string" ? pagePendentes : undefined,
            }}
          />
        </div>
      )}

      <Link href="/cadastro?tipo=orgao" className="text-sm text-brand underline">
        {t("verFormularioPublico")}
      </Link>
    </main>
  );
}
