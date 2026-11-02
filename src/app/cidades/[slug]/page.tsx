import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ListFilter, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { Secao } from "@/components/ui/secao";
import { CartaoReclamacao } from "@/components/reclamacao/cartao-reclamacao";
import { CategoriaIcon } from "@/components/reclamacao/categoria-icon";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import {
  botaoPrimario,
  campoInput,
  colunaPrincipal,
  grade,
  pagina,
  rotuloSecao,
} from "@/lib/estilos";
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
    <main className={pagina}>
      <CabecalhoPagina
        kicker={cidade.estado.nome}
        titulo={`${cidade.nome} - ${cidade.estado.uf}`}
        descricao={t("totalPublico", { count: totalPublico })}
        acoes={
          <SeguirCidade cidadeId={cidade.id} logado={!!session?.user} jaAssina={jaAssinaCidade} />
        }
      />

      <Secao id="indice" titulo={t("indiceResolucao")}>
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-12">
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
      </Secao>

      <div className={grade}>
        <div className={colunaPrincipal}>
          <Secao id="reclamacoes" titulo={t("reclamacoes")} contador={totalFeed}>
            <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5">
              <form method="get" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="ordenar" value={ordenar} />
                <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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
                <div className="flex min-w-40 flex-1 flex-col gap-1.5">
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

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <span className={rotuloSecao}>{t("ordenarPor")}</span>
                <div className="flex gap-1 rounded-md bg-sunken p-1">
                  <Link
                    href={linkFeed(slug, estadoFeed, { ordenar: "recentes", pagina: 1 })}
                    aria-current={ordenar === "recentes" ? "true" : undefined}
                    className={
                      ordenar === "recentes"
                        ? "rounded-[5px] bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-[0_1px_2px_rgb(14_21_32/0.12)]"
                        : "rounded-[5px] px-3 py-1 text-xs font-medium text-ink-muted hover:text-ink"
                    }
                  >
                    {t("maisRecentes")}
                  </Link>
                  <Link
                    href={linkFeed(slug, estadoFeed, { ordenar: "confirmadas", pagina: 1 })}
                    aria-current={ordenar === "confirmadas" ? "true" : undefined}
                    className={
                      ordenar === "confirmadas"
                        ? "rounded-[5px] bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-[0_1px_2px_rgb(14_21_32/0.12)]"
                        : "rounded-[5px] px-3 py-1 text-xs font-medium text-ink-muted hover:text-ink"
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
                      categoria={{
                        nome: reclamacao.categoria.nome,
                        icone: reclamacao.categoria.icone,
                      }}
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
          </Secao>
        </div>

        <aside className="flex flex-col gap-10 lg:col-span-4">
          <Secao id="categorias" titulo={t("categoriasMaisReclamadas")}>
            {ranking.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("nenhumaReclamacaoPublica")}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {ranking.map(
                  (item) =>
                    item.categoria && (
                      <li key={item.categoria.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2.5 text-sm">
                          <CategoriaIcon
                            icone={item.categoria.icone}
                            className="h-4 w-4 shrink-0 text-ink-muted"
                          />
                          <span className="flex-1 text-ink-2">{item.categoria.nome}</span>
                          <span className="font-mono font-medium tabular-nums text-ink">
                            {item.total}
                          </span>
                        </div>
                        {/* Barra proporcional à categoria mais reclamada. Uma cor
                            só: é uma série única, ordenada - não há o que
                            diferenciar por matiz. */}
                        <div aria-hidden className="h-1.5 rounded-xs bg-sunken">
                          <div
                            className="h-full rounded-xs bg-brand"
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
          </Secao>

          <Secao id="orgaos" titulo={t("orgaosDestaCidade")}>
            {rankingOrgaos.length === 0 ? (
              <p className="text-sm text-ink-muted">{t("nenhumOrgaoCadastrado")}</p>
            ) : (
              <ul className="-mt-2 divide-y divide-line">
                {rankingOrgaos.map(({ orgao, metricas }) => {
                  const classificacao = classificarIndice(
                    metricas.indiceResolucao,
                    metricas.totalRespondidas
                  );
                  return (
                    <li key={orgao.id}>
                      <Link
                        href={`/orgaos/${orgao.id}`}
                        className="group flex items-center gap-3 py-3.5 transition-colors"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="line-clamp-2 text-sm font-bold text-ink group-hover:text-brand">
                            {orgao.nome}
                            {orgao.sigla && ` (${orgao.sigla})`}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {t("reclamacoesRespondidas", { count: metricas.totalRespondidas })}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-[5px] px-2 py-0.5 text-xs font-semibold ${classificacao.className}`}
                        >
                          {tSelo(classificacao.chave)}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>
        </aside>
      </div>
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
    <div className="flex flex-col gap-3">
      <h3 className={rotuloSecao}>{titulo}</h3>
      {valor === null ? (
        <p className="text-sm text-ink-muted">{vazio}</p>
      ) : (
        <>
          <p className="font-mono text-6xl leading-none font-medium tracking-tight text-ink tabular-nums">
            {valor}
            <span className="text-3xl text-ink-muted">%</span>
          </p>
          <div
            role="progressbar"
            aria-valuenow={valor}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={titulo}
            className="h-2 rounded-xs bg-sunken"
          >
            <div className="h-full rounded-xs bg-ok-ink" style={{ width: `${valor}%` }} />
          </div>
          <p className="text-sm text-ink-muted">{legenda}</p>
        </>
      )}
    </div>
  );
}
