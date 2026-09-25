import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, cartao, containerPagina } from "@/lib/estilos";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";
import { atualizarCategoriasOrgao } from "./actions";

export default async function OrgaosCategoriasPage({
  searchParams,
}: PageProps<"/orgaos-categorias">) {
  const t = await getTranslations("OrgaosCategorias");
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { ativo: true };

  const [orgaos, totalOrgaos, categorias] = await Promise.all([
    prisma.orgao.findMany({
      where: filtro,
      orderBy: { nome: "asc" },
      include: { cidade: true, categorias: { select: { id: true } } },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.orgao.count({ where: filtro }),
    prisma.categoria.findMany({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalOrgaos);

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("descricao")}</p>
      </div>

      {orgaos.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumOrgaoAtivo")}</p>
      )}

      {orgaos.map((orgao) => (
        <form
          key={orgao.id}
          action={atualizarCategoriasOrgao.bind(null, orgao.id)}
          className={`flex flex-col gap-3 ${cartao}`}
        >
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {orgao.nome}
              {orgao.sigla && ` (${orgao.sigla})`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{orgao.cidade.nome}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categorias.map((categoria) => (
              <label
                key={categoria.id}
                className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  name="categoriaIds"
                  value={categoria.id}
                  defaultChecked={orgao.categorias.some((c) => c.id === categoria.id)}
                />
                {categoria.nome}
              </label>
            ))}
          </div>

          <button type="submit" className={`${botaoPrimario} w-fit`}>
            {t("salvar")}
          </button>
        </form>
      ))}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/orgaos-categorias"
      />
    </main>
  );
}
