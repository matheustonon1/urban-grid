import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, campoInput, cartao, containerPagina } from "@/lib/estilos";

import { exigirAdmin } from "../solicitacoes-orgao/exigir-admin";
import { alternarAtivoOrgao, atualizarCategoriasOrgao, atualizarDadosOrgao } from "./actions";

export default async function OrgaosCategoriasPage({
  searchParams,
}: PageProps<"/orgaos-categorias">) {
  const t = await getTranslations("OrgaosCategorias");
  await exigirAdmin();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);

  // Sem filtro por ativo aqui de propósito - esta é a única tela admin
  // que lista órgãos, então também precisa ser onde um órgão inativo
  // aparece pra poder ser reativado (ver alternarAtivoOrgao em ./actions).
  const [orgaos, totalOrgaos, categorias] = await Promise.all([
    prisma.orgao.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { cidade: true, categorias: { select: { id: true } } },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.orgao.count(),
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
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumOrgao")}</p>
      )}

      {orgaos.map((orgao) => (
        <div
          key={orgao.id}
          className={`flex flex-col gap-3 ${cartao} ${!orgao.ativo ? "opacity-60" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                {orgao.nome}
                {orgao.sigla && ` (${orgao.sigla})`}
                {!orgao.ativo && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {t("inativo")}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{orgao.cidade.nome}</p>
            </div>

            <form action={alternarAtivoOrgao.bind(null, orgao.id, !orgao.ativo)}>
              <button
                type="submit"
                className={
                  orgao.ativo
                    ? "rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                    : botaoSecundario
                }
              >
                {orgao.ativo ? t("desativar") : t("reativar")}
              </button>
            </form>
          </div>

          <details className="text-sm">
            <summary className="w-fit cursor-pointer text-primary">{t("editarDados")}</summary>
            <form
              action={atualizarDadosOrgao.bind(null, orgao.id)}
              className="animate-fade-in mt-2 flex flex-wrap gap-2"
            >
              <input
                type="text"
                name="nome"
                required
                defaultValue={orgao.nome}
                placeholder={t("nome")}
                className={`min-w-40 flex-1 ${campoInput}`}
              />
              <input
                type="text"
                name="sigla"
                defaultValue={orgao.sigla ?? ""}
                placeholder={t("sigla")}
                className={`w-24 ${campoInput}`}
              />
              <input
                type="email"
                name="email"
                defaultValue={orgao.email ?? ""}
                placeholder={t("email")}
                className={`min-w-48 flex-1 ${campoInput}`}
              />
              <button type="submit" className={botaoSecundario}>
                {t("salvarDados")}
              </button>
            </form>
          </details>

          <form
            action={atualizarCategoriasOrgao.bind(null, orgao.id)}
            className="flex flex-col gap-3"
          >
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
        </div>
      ))}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/orgaos-categorias"
      />
    </main>
  );
}
