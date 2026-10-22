import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ListFilter, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CartaoReclamacao } from "@/components/reclamacao/cartao-reclamacao";
import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { botaoPrimario, campoInput, cartao, containerMedio, rotuloSecao } from "@/lib/estilos";
import { calcularMetricasOrgao, classificarIndice } from "@/lib/orgaos/reputacaoOrgao";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";

import { SeguirCidade } from "./seguir-cidade";

const TAMANHO_PAGINA = 10;

type OrdenacaoFeed = "recentes" | "confirmadas";

interface EstadoFeed {
  categoriaId?: string;
  status?: (typeof STATUS_PUBLICOS)[number];
  ordenar: OrdenacaoFeed;
  pagina: number;
}

function valorUnico(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function linkFeed(slug: string, estado: EstadoFeed, overrides: Partial<EstadoFeed>) {
  const final = { ...estado, ...overrides };
  const params = new URLSearchParams();
  if (final.categoriaId) params.set("categoriaId", final.categoriaId);
  if (final.status) params.set("status", final.status);
  if (final.ordenar !== "recentes") params.set("ordenar", final.ordenar);
  if (final.pagina > 1) params.set("pagina", String(final.pagina));

  const query = params.toString();
  return `/cidades/${slug}${query ? `?${query}` : ""}`;
}

// Mesma consulta pra página e pro generateMetadata, uma ida ao banco só.
const buscarCidade = cache((slug: string) =>
  prisma.cidade.findUnique({ where: { slug }, include: { estado: true } })
);

export async function generateMetadata({ params }: PageProps<"/cidades/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations("CidadeDetalhe");
  const cidade = await buscarCidade(slug);
  if (!cidade) return {};

  const rotulo = `${cidade.nome} - ${cidade.estado.uf}`;
  return { title: rotulo, description: t("metaDescricao", { cidade: rotulo }) };
}

export default async function CidadePage({
  params,
  searchParams,
}: PageProps<"/cidades/[slug]">) {
  const t = await getTranslations("CidadeDetalhe");
  const tStatus = await getTranslations("Status");
  const tSelo = await getTranslations("Selo");
  const { slug } = await params;
  const query = await searchParams;

  const cidade = await buscarCidade(slug);
  if (!cidade) {
    notFound();
  }

  const session = await auth();
  const jaAssinaCidade = session?.user
    ? Boolean(
        await prisma.assinaturaCidade.findFirst({
          where: { userId: session.user.id, cidadeId: cidade.id, categoriaId: null },
          select: { id: true },
        })
      )
    : false;

  const categoriaId = valorUnico(query.categoriaId) || undefined;
  const statusBruto = valorUnico(query.status);
  const status = STATUS_PUBLICOS.find((s) => s === statusBruto);
  const ordenar: OrdenacaoFeed = valorUnico(query.ordenar) === "confirmadas" ? "confirmadas" : "recentes";
  const paginaAtual = Math.max(1, Number(valorUnico(query.pagina)) || 1);

  const estadoFeed: EstadoFeed = { categoriaId, status, ordenar, pagina: paginaAtual };

  const filtroFeed = {
    cidadeId: cidade.id,
    status: status ?? { in: [...STATUS_PUBLICOS] },
    ...(categoriaId ? { categoriaId } : {}),
  };

  const [
    porCategoria,
    totalPublico,
    resolvidas,
    avaliacoes,
    categoriasAtivas,
    orgaosAtivos,
    totalFeed,
    reclamacoes,
  ] = await Promise.all([
    prisma.reclamacao.groupBy({
      by: ["categoriaId"],
      where: { cidadeId: cidade.id, status: { in: [...STATUS_PUBLICOS] } },
      _count: { categoriaId: true },
      orderBy: { _count: { categoriaId: "desc" } },
      take: 5,
    }),
    prisma.reclamacao.count({
      where: { cidadeId: cidade.id, status: { in: [...STATUS_PUBLICOS] } },
    }),
    prisma.reclamacao.count({
      where: { cidadeId: cidade.id, status: "RESOLVIDA" },
    }),
    prisma.avaliacao.groupBy({
      by: ["resolvido"],
      where: { reclamacao: { cidadeId: cidade.id } },
      _count: { _all: true },
    }),
    prisma.categoria.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
    prisma.orgao.findMany({ where: { cidadeId: cidade.id, ativo: true } }),
    prisma.reclamacao.count({ where: filtroFeed }),
    prisma.reclamacao.findMany({
      where: filtroFeed,
      orderBy:
        ordenar === "confirmadas"
          ? { confirmacoes: { _count: "desc" } }
          : { createdAt: "desc" },
      skip: (paginaAtual - 1) * TAMANHO_PAGINA,
      take: TAMANHO_PAGINA,
      include: {
        categoria: true,
        bairro: true,
        midias: { orderBy: { ordem: "asc" }, take: 1 },
        _count: { select: { confirmacoes: true } },
      },
    }),
  ]);

  const categorias = await prisma.categoria.findMany({
    where: { id: { in: porCategoria.map((item) => item.categoriaId) } },
  });
  const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
  const ranking = porCategoria.map((item) => ({
    categoria: categoriaPorId.get(item.categoriaId),
    total: item._count.categoriaId,
  }));

  const maiorCategoria = Math.max(1, ...ranking.map((item) => item.total));

  const totalAvaliadas = avaliacoes.reduce((soma, a) => soma + a._count._all, 0);
  const confirmadasPeloCidadao =
    avaliacoes.find((a) => a.resolvido)?._count._all ?? 0;

  const indiceOrgao =
    totalPublico > 0 ? Math.round((resolvidas / totalPublico) * 100) : null;
  const indiceCidadao =
    totalAvaliadas > 0
      ? Math.round((confirmadasPeloCidadao / totalAvaliadas) * 100)
      : null;

  const totalPaginas = Math.max(1, Math.ceil(totalFeed / TAMANHO_PAGINA));

  const rankingOrgaos = (
    await Promise.all(
      orgaosAtivos.map(async (orgao) => ({
        orgao,
        metricas: await calcularMetricasOrgao(orgao.id),
      }))
    )
  ).sort((a, b) => (b.metricas.indiceResolucao ?? -1) - (a.metricas.indiceResolucao ?? -1));

  return (
    <main className={`${containerMedio} gap-8`}>
      <CabecalhoPagina
        titulo={`${cidade.nome} - ${cidade.estado.uf}`}
        descricao={t("totalPublico", { count: totalPublico })}
        acoes={
          <SeguirCidade cidadeId={cidade.id} logado={!!session?.user} jaAssina={jaAssinaCidade} />
        }
      />

      <section className={`flex flex-col gap-5 ${cartao}`}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("indiceResolucao")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Indicador
            titulo={t("indiceOrgaoTitulo")}
            valor={indiceOrgao}
            legenda={t("indiceOrgaoLegenda")}
            vazio={t("semReclamacoesSuficientes")}
          />
          <Indicador
            titulo={t("indiceCidadaoTitulo")}
            valor={indiceCidadao}
            legenda={t("indiceCidadaoLegenda", {
              confirmadas: confirmadasPeloCidadao,
              total: totalAvaliadas,
            })}
            vazio={t("semAvaliacoesSuficientes")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("categoriasMaisReclamadas")}
        </h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("nenhumaReclamacaoPublica")}
          </p>
        ) : (
          <ul className={`flex flex-col gap-4 ${cartao}`}>
            {ranking.map(
              (item) =>
                item.categoria && (
                  <li key={item.categoria.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <CategoriaIcon
                        icone={item.categoria.icone}
                        className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                      />
                      <span className="flex-1 text-slate-800 dark:text-slate-200">
                        {item.categoria.nome}
                      </span>
                      <span className="font-mono font-medium tabular-nums text-slate-700 dark:text-slate-300">
                        {item.total}
                      </span>
                    </div>
                    {/* Barra proporcional à categoria mais reclamada. Uma cor
                        só: é uma série única, ordenada - não há o que
                        diferenciar por matiz. */}
                    <div aria-hidden className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{
                          width: `${Math.max(4, Math.round((item.total / maiorCategoria) * 100))}%`,
                        }}
                      />
                    </div>
                  </li>
                )
            )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("orgaosDestaCidade")}
        </h2>
        {rankingOrgaos.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("nenhumOrgaoCadastrado")}
          </p>
        ) : (
          <ul className={`divide-y divide-slate-200 overflow-hidden p-0 dark:divide-slate-800 ${cartao}`}>
            {rankingOrgaos.map(({ orgao, metricas }) => {
              const classificacao = classificarIndice(
                metricas.indiceResolucao,
                metricas.totalRespondidas
              );
              return (
                <li key={orgao.id}>
                  <Link
                    href={`/orgaos/${orgao.id}`}
                    className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-primary dark:text-slate-100">
                        {orgao.nome}
                        {orgao.sigla && ` (${orgao.sigla})`}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
                      </span>
                    </div>
                    <span
                      className={`inline-block shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${classificacao.className}`}
                    >
                      {tSelo(classificacao.chave)}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:text-slate-600"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("reclamacoes")} {totalFeed > 0 && `(${totalFeed})`}
        </h2>

        <div className={`flex flex-col gap-4 ${cartao}`}>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="ordenar" value={ordenar} />
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label htmlFor="categoriaId" className={rotuloSecao}>
                {t("categoria")}
              </label>
              <select
                id="categoriaId"
                name="categoriaId"
                defaultValue={categoriaId ?? ""}
                className={campoInput}
              >
                <option value="">{t("todas")}</option>
                {categoriasAtivas.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label htmlFor="status" className={rotuloSecao}>
                {t("status")}
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ""}
                className={campoInput}
              >
                <option value="">{t("todos")}</option>
                {STATUS_PUBLICOS.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(s)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={botaoPrimario}>
              <ListFilter className="h-4 w-4" aria-hidden />
              {t("filtrar")}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className={rotuloSecao}>{t("ordenarPor")}</span>
            <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              <Link
                href={linkFeed(slug, estadoFeed, { ordenar: "recentes", pagina: 1 })}
                className={
                  ordenar === "recentes"
                    ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-slate-700"
                    : "rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }
              >
                {t("maisRecentes")}
              </Link>
              <Link
                href={linkFeed(slug, estadoFeed, { ordenar: "confirmadas", pagina: 1 })}
                className={
                  ordenar === "confirmadas"
                    ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-slate-700"
                    : "rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }
              >
                {t("maisConfirmadas")}
              </Link>
            </div>
          </div>
        </div>

        {reclamacoes.length === 0 ? (
          <EstadoVazio icone={SearchX} titulo={t("nenhumaComFiltros")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {reclamacoes.map((reclamacao) => (
              <li key={reclamacao.id}>
                <CartaoReclamacao
                  protocolo={reclamacao.protocolo}
                  titulo={reclamacao.titulo}
                  status={reclamacao.status}
                  categoria={{ nome: reclamacao.categoria.nome, icone: reclamacao.categoria.icone }}
                  local={reclamacao.bairro?.nome}
                  descricao={reclamacao.descricao}
                  fotoUrl={
                    reclamacao.midias[0]
                      ? (reclamacao.midias[0].urlTratada ?? reclamacao.midias[0].url)
                      : null
                  }
                  confirmacoes={reclamacao._count.confirmacoes}
                  data={reclamacao.createdAt}
                />
              </li>
            ))}
          </ul>
        )}

        <Paginacao
          paginaAtual={paginaAtual}
          totalPaginas={totalPaginas}
          basePath={`/cidades/${slug}`}
          paramName="pagina"
          searchParams={{
            categoriaId,
            status,
            ordenar: ordenar !== "recentes" ? ordenar : undefined,
          }}
        />
      </section>
    </main>
  );
}

// Índice como número grande + barra + o que ele significa (a legenda traz a
// ressalva de quem reporta o dado - "autorreportado pelo órgão" -, que é parte
// da informação, não rodapé). Sem dado suficiente, mostra o motivo em vez de 0%.
function Indicador({
  titulo,
  valor,
  legenda,
  vazio,
}: {
  titulo: string;
  valor: number | null;
  legenda: string;
  vazio: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={rotuloSecao}>{titulo}</h3>
      {valor === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{vazio}</p>
      ) : (
        <>
          <p className="font-mono text-3xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {valor}%
          </p>
          <div
            role="progressbar"
            aria-valuenow={valor}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={titulo}
            className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <div
              className="h-full rounded-full bg-green-600 dark:bg-green-500"
              style={{ width: `${valor}%` }}
            />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">{legenda}</p>
        </>
      )}
    </div>
  );
}
