import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { SeletorCidade } from "@/components/cidade-combobox";
import { StatusBadge } from "@/components/status-badge";
import { CategoriaIcon } from "@/components/categoria-icon";
import { Paginacao } from "@/components/paginacao";
import { formatarTempoRelativo } from "@/lib/tempo-relativo";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, campoInput, cartao, containerPagina } from "@/lib/estilos";

export default async function ReclamacoesPublicasPage({
  searchParams,
}: PageProps<"/reclamacoes">) {
  const { cidadeId, categoriaId, q, page } = await searchParams;
  const cidadeIdFiltro =
    typeof cidadeId === "string" && cidadeId ? cidadeId : undefined;
  const categoriaIdFiltro =
    typeof categoriaId === "string" && categoriaId ? categoriaId : undefined;
  const buscaFiltro = typeof q === "string" && q.trim() ? q.trim() : undefined;
  const paginaAtual = lerPaginaAtual(page);

  const filtro = {
    status: "PUBLICADA" as const,
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
  const categoriaFiltro = categoriaIdFiltro
    ? categoriasAtivas.find((categoria) => categoria.id === categoriaIdFiltro)
    : undefined;

  return (
    <main className={containerPagina}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        Reclamações públicas
      </h1>

      <form className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={buscaFiltro ?? ""}
          placeholder="Buscar por palavra-chave..."
          className={`min-w-48 flex-1 ${campoInput}`}
        />
        <div className="min-w-48 flex-1">
          <SeletorCidade
            placeholder="Buscar por cidade ou estado..."
            defaultValue={
              cidadeFiltro
                ? {
                    id: cidadeFiltro.id,
                    nome: cidadeFiltro.nome,
                    uf: cidadeFiltro.estado.uf,
                  }
                : null
            }
          />
        </div>
        <select
          name="categoriaId"
          defaultValue={categoriaIdFiltro ?? ""}
          className={`min-w-48 flex-1 ${campoInput}`}
        >
          <option value="">Todas as categorias</option>
          {categoriasAtivas.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
        <button type="submit" className={botaoPrimario}>
          Filtrar
        </button>
      </form>

      {(cidadeFiltro || categoriaFiltro || buscaFiltro) && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mostrando resultados
          {buscaFiltro && (
            <>
              {" "}
              para <strong>&quot;{buscaFiltro}&quot;</strong>
            </>
          )}
          {categoriaFiltro && (
            <>
              {" "}
              em <strong>{categoriaFiltro.nome}</strong>
            </>
          )}
          {cidadeFiltro && (
            <>
              {" "}
              em{" "}
              <Link href={`/cidades/${cidadeFiltro.slug}`} className="text-primary underline">
                <strong>
                  {cidadeFiltro.nome} - {cidadeFiltro.estado.uf}
                </strong>
              </Link>
            </>
          )}{" "}
          ·{" "}
          <Link href="/reclamacoes" className="text-primary underline">
            limpar
          </Link>
        </p>
      )}

      {reclamacoes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma reclamação publicada ainda.
        </p>
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
              {formatarTempoRelativo(reclamacao.publicadaEm ?? reclamacao.createdAt)}
            </p>
            <p className="mt-1 text-sm font-medium text-primary">
              {reclamacao._count.confirmacoes} confirmação(ões)
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
