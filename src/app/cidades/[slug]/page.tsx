import Link from "next/link";
import { notFound } from "next/navigation";
import { ListFilter } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { CategoriaIcon } from "@/components/categoria-icon";
import { botaoPrimario, campoInput, cartao, containerPagina } from "@/lib/estilos";
import { SELO_LABEL_PT, calcularMetricasOrgao, classificarIndice } from "@/lib/reputacaoOrgao";

const STATUS_PUBLICOS = [
  "PUBLICADA",
  "EM_ANDAMENTO",
  "RESOLVIDA",
  "ARQUIVADA",
] as const;

const STATUS_LABEL: Record<(typeof STATUS_PUBLICOS)[number], string> = {
  PUBLICADA: "Publicada",
  EM_ANDAMENTO: "Em andamento",
  RESOLVIDA: "Resolvida",
  ARQUIVADA: "Arquivada",
};

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

export default async function CidadePage({
  params,
  searchParams,
}: PageProps<"/cidades/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;

  const cidade = await prisma.cidade.findUnique({
    where: { slug },
    include: { estado: true },
  });
  if (!cidade) {
    notFound();
  }

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
    <main className={containerPagina}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {cidade.nome} - {cidade.estado.uf}
      </h1>

      <div className={`flex flex-col gap-2 ${cartao}`}>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Índice de resolução
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {indiceOrgao !== null
            ? `${indiceOrgao}% das reclamações públicas estão marcadas como resolvidas (autorreportado pelo órgão).`
            : "Ainda não há reclamações públicas suficientes nesta cidade."}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {indiceCidadao !== null
            ? `${indiceCidadao}% dos cidadãos que avaliaram confirmam que o problema foi resolvido (${confirmadasPeloCidadao} de ${totalAvaliadas} avaliadas).`
            : "Ainda não há avaliações de cidadãos suficientes nesta cidade."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Categorias mais reclamadas
        </h2>
        {ranking.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma reclamação pública nesta cidade ainda.
          </p>
        )}
        {ranking.map(
          (item) =>
            item.categoria && (
              <div key={item.categoria.id} className={`flex items-center gap-3 ${cartao}`}>
                <CategoriaIcon
                  icone={item.categoria.icone}
                  className="h-5 w-5 text-slate-400 dark:text-slate-500"
                />
                <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                  {item.categoria.nome}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {item.total}
                </span>
              </div>
            )
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Órgãos desta cidade
        </h2>
        {rankingOrgaos.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhum órgão cadastrado nesta cidade ainda.
          </p>
        )}
        {rankingOrgaos.map(({ orgao, metricas }) => {
          const classificacao = classificarIndice(
            metricas.indiceResolucao,
            metricas.totalRespondidas
          );
          return (
            <Link
              key={orgao.id}
              href={`/orgaos/${orgao.id}`}
              className={`flex items-center gap-3 ${cartao} transition hover:border-primary`}
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {orgao.nome}
                  {orgao.sigla && ` (${orgao.sigla})`}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {metricas.totalRespondidas} reclamação(ões) respondida(s)
                </span>
              </div>
              <span
                className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${classificacao.className}`}
              >
                {SELO_LABEL_PT[classificacao.chave]}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Reclamações {totalFeed > 0 && `(${totalFeed})`}
        </h2>

        <div className={`flex flex-col gap-4 ${cartao}`}>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="ordenar" value={ordenar} />
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label
                htmlFor="categoriaId"
                className="text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Categoria
              </label>
              <select
                id="categoriaId"
                name="categoriaId"
                defaultValue={categoriaId ?? ""}
                className={campoInput}
              >
                <option value="">Todas</option>
                {categoriasAtivas.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label
                htmlFor="status"
                className="text-xs font-medium text-slate-500 dark:text-slate-400"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status ?? ""}
                className={campoInput}
              >
                <option value="">Todos</option>
                {STATUS_PUBLICOS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={botaoPrimario}>
              <ListFilter className="h-4 w-4" />
              Filtrar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Ordenar por
            </span>
            <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
              <Link
                href={linkFeed(slug, estadoFeed, { ordenar: "recentes", pagina: 1 })}
                className={
                  ordenar === "recentes"
                    ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-slate-700"
                    : "rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }
              >
                Mais recentes
              </Link>
              <Link
                href={linkFeed(slug, estadoFeed, { ordenar: "confirmadas", pagina: 1 })}
                className={
                  ordenar === "confirmadas"
                    ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm dark:bg-slate-700"
                    : "rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }
              >
                Mais confirmadas
              </Link>
            </div>
          </div>
        </div>

        {reclamacoes.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nenhuma reclamação encontrada com esses filtros.
          </p>
        )}

        {reclamacoes.map((reclamacao) => (
          <Link
            key={reclamacao.id}
            href={`/reclamacoes/${reclamacao.protocolo}`}
            className={`flex flex-col gap-2 ${cartao} transition hover:border-primary hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                {reclamacao.titulo}
              </h3>
              <StatusBadge status={reclamacao.status} />
            </div>
            <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <CategoriaIcon
                icone={reclamacao.categoria.icone}
                className="h-4 w-4 text-slate-400 dark:text-slate-500"
              />
              {reclamacao.categoria.nome}
              {reclamacao.bairro && ` · ${reclamacao.bairro.nome}`}
            </p>
            <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-300">
              {reclamacao.descricao}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {reclamacao._count.confirmacoes} pessoa(s) confirmaram ·{" "}
              {reclamacao.createdAt.toLocaleDateString("pt-BR")}
            </p>
          </Link>
        ))}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between text-sm">
            {paginaAtual > 1 ? (
              <Link
                href={linkFeed(slug, estadoFeed, { pagina: paginaAtual - 1 })}
                className="text-primary underline"
              >
                ← Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500 dark:text-slate-400">
              Página {paginaAtual} de {totalPaginas}
            </span>
            {paginaAtual < totalPaginas ? (
              <Link
                href={linkFeed(slug, estadoFeed, { pagina: paginaAtual + 1 })}
                className="text-primary underline"
              >
                Próxima →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
