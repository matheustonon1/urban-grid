import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { CategoriaIcon } from "@/components/categoria-icon";
import { Paginacao } from "@/components/paginacao";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { cartao, containerPagina } from "@/lib/estilos";
import { STATUS_PUBLICOS } from "@/lib/statusPublicos";

import { FiltroReclamacoes } from "./filtro";

export default async function ReclamacoesPublicasPage({
  searchParams,
}: PageProps<"/reclamacoes">) {
  const t = await getTranslations("Reclamacoes");
  const locale = await getLocale();
  const { cidadeId, categoriaId, q, page } = await searchParams;
  const cidadeIdFiltro =
    typeof cidadeId === "string" && cidadeId ? cidadeId : undefined;
  const categoriaIdFiltro =
    typeof categoriaId === "string" && categoriaId ? categoriaId : undefined;
  const buscaFiltro = typeof q === "string" && q.trim() ? q.trim() : undefined;
  const paginaAtual = lerPaginaAtual(page);

  const filtro = {
    status: { in: [...STATUS_PUBLICOS] },
    ...(cidadeIdFiltro ? { cidadeId: cidadeIdFiltro } : {}),
    ...(categoriaIdFiltro ? { categoriaId: categoriaIdFiltro } : {}),
    ...(buscaFiltro
      ? {
          OR: [
            { titulo: { contains: buscaFiltro } },
            { descricao: { contains: buscaFiltro } },
          ],
        }
      : {}),
  };

  const [reclamacoes, totalReclamacoes, cidadeFiltro, categoriasAtivas] = await Promise.all([
    prisma.reclamacao.findMany({
      where: filtro,
      orderBy: { publicadaEm: "desc" },
      include: {
        categoria: true,
        cidade: true,
        _count: { select: { confirmacoes: true } },
        midias: { orderBy: { ordem: "asc" }, take: 1 },
      },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.reclamacao.count({ where: filtro }),
    cidadeIdFiltro
      ? prisma.cidade.findUnique({
          where: { id: cidadeIdFiltro },
          select: { id: true, nome: true, slug: true, estado: { select: { uf: true } } },
        })
      : null,
    prisma.categoria.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalReclamacoes);

  return (
    <main className={containerPagina}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("titulo")}
      </h1>

      <FiltroReclamacoes
        categorias={categoriasAtivas}
        categoriaIdFiltro={categoriaIdFiltro}
        cidadeFiltro={
          cidadeFiltro
            ? {
                id: cidadeFiltro.id,
                nome: cidadeFiltro.nome,
                slug: cidadeFiltro.slug,
                estado: { uf: cidadeFiltro.estado.uf },
              }
            : null
        }
        buscaFiltro={buscaFiltro}
      />

      {reclamacoes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaPublicada")}</p>
      )}

      {reclamacoes.map((reclamacao) => (
        <Link
          key={reclamacao.id}
          href={`/reclamacoes/${reclamacao.protocolo}`}
          className={`flex items-start gap-3 transition hover:border-slate-300 hover:shadow dark:hover:border-slate-600 ${cartao}`}
        >
          {reclamacao.midias[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Vercel Blob), sem domínio fixo pra configurar no next/image
            <img
              src={reclamacao.midias[0].urlTratada ?? reclamacao.midias[0].url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
            />
          ) : (
            <CategoriaIcon
              icone={reclamacao.categoria.icone}
              className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500"
            />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-900 dark:text-slate-100">{reclamacao.titulo}</p>
              <StatusBadge status={reclamacao.status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {reclamacao.categoria.nome} · {reclamacao.cidade.nome} ·{" "}
              {formatarTempoRelativo(reclamacao.publicadaEm ?? reclamacao.createdAt, locale)}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              {t("confirmacoes", { count: reclamacao._count.confirmacoes })}
            </p>
          </div>
        </Link>
      ))}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/reclamacoes"
        searchParams={{ cidadeId: cidadeIdFiltro, categoriaId: categoriaIdFiltro, q: buscaFiltro }}
      />
    </main>
  );
}
