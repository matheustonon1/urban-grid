import Link from "next/link";
import { Plus, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { CabecalhoPagina } from "@/components/ui/cabecalho-pagina";
import { CartaoReclamacao } from "@/components/reclamacao/cartao-reclamacao";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Paginacao } from "@/components/ui/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/util/paginacao";
import { botaoPrimario, containerMedio } from "@/lib/estilos";
import { STATUS_PUBLICOS } from "@/lib/reclamacoes/statusPublicos";
import { metadataDaPagina } from "@/lib/metadata";

import { FiltroReclamacoes } from "./filtro";

export const generateMetadata = metadataDaPagina("Reclamacoes");

export default async function ReclamacoesPublicasPage({
  searchParams,
}: PageProps<"/reclamacoes">) {
  const t = await getTranslations("Reclamacoes");
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

  const [reclamacoes, totalReclamacoes, cidadeFiltro, categoriasAtivas, categoriaFiltroInativa] =
    await Promise.all([
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
      // Um link salvo/compartilhado pode apontar pra uma categoria
      // desativada depois - o filtro em si continua valendo (aplicado
      // acima em `filtro`), então o chip/seletor precisam conseguir
      // mostrá-la mesmo fora da lista de categorias ativas, ou a pessoa
      // vê uma lista filtrada sem nenhuma indicação visível do porquê.
      categoriaIdFiltro
        ? prisma.categoria.findFirst({ where: { id: categoriaIdFiltro, ativa: false } })
        : null,
    ]);
  const totalPaginas = calcularTotalPaginas(totalReclamacoes);
  const categoriasParaFiltro = categoriaFiltroInativa
    ? [...categoriasAtivas, categoriaFiltroInativa]
    : categoriasAtivas;

  const novaReclamacao = (
    <Link href="/reclamacoes/nova" className={botaoPrimario}>
      <Plus className="h-4 w-4" aria-hidden />
      {t("registrar")}
    </Link>
  );

  return (
    <main className={containerMedio}>
      <CabecalhoPagina
        titulo={t("titulo")}
        descricao={t("subtitulo")}
        // No estado vazio o mesmo botão já aparece dentro dele.
        acoes={reclamacoes.length > 0 ? novaReclamacao : undefined}
      />

      <FiltroReclamacoes
        categorias={categoriasParaFiltro}
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

      {reclamacoes.length === 0 ? (
        <EstadoVazio
          icone={SearchX}
          titulo={t("nenhumaPublicada")}
          descricao={t("nenhumaPublicadaDesc")}
        >
          {novaReclamacao}
        </EstadoVazio>
      ) : (
        <>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {t("resultados", { count: totalReclamacoes })}
          </p>
          <ul className="flex flex-col gap-3">
            {reclamacoes.map((reclamacao) => (
              <li key={reclamacao.id}>
                <CartaoReclamacao
                  protocolo={reclamacao.protocolo}
                  titulo={reclamacao.titulo}
                  status={reclamacao.status}
                  categoria={{ nome: reclamacao.categoria.nome, icone: reclamacao.categoria.icone }}
                  local={reclamacao.cidade.nome}
                  fotoUrl={reclamacao.midias[0] ? (reclamacao.midias[0].urlTratada ?? reclamacao.midias[0].url) : null}
                  confirmacoes={reclamacao._count.confirmacoes}
                  data={reclamacao.publicadaEm ?? reclamacao.createdAt}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/reclamacoes"
        searchParams={{ cidadeId: cidadeIdFiltro, categoriaId: categoriaIdFiltro, q: buscaFiltro }}
      />
    </main>
  );
}
