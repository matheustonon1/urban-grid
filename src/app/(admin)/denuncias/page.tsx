import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, cartao, containerPagina } from "@/lib/estilos";

import { exigirModerador } from "../moderacao/exigir-moderador";
import { banirAutor, marcarImprocedente, marcarProcedente } from "./actions";

export default async function DenunciasPage({ searchParams }: PageProps<"/denuncias">) {
  const t = await getTranslations("Denuncias");
  const tMotivo = await getTranslations("MotivoDenuncia");
  const locale = await getLocale();
  await exigirModerador();
  const session = await auth();
  const ehAdmin = session?.user?.papel === "ADMIN";

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { status: "ABERTA" as const };

  const [denuncias, totalDenuncias] = await Promise.all([
    prisma.denuncia.findMany({
      where: filtro,
      orderBy: { createdAt: "asc" },
      include: { denunciante: true },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.denuncia.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalDenuncias);

  const reclamacoes = denuncias.length
    ? await prisma.reclamacao.findMany({
        where: { id: { in: denuncias.map((d) => d.alvoId) } },
        select: { id: true, protocolo: true, titulo: true, descricao: true },
      })
    : [];
  const reclamacaoPorId = new Map(reclamacoes.map((r) => [r.id, r]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {t("titulo")}
      </h1>

      {denuncias.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaEmAberto")}</p>
      )}

      {denuncias.map((denuncia) => {
        const reclamacao = reclamacaoPorId.get(denuncia.alvoId);

        return (
          <div key={denuncia.id} className={`flex flex-col gap-2 ${cartao}`}>
            {reclamacao ? (
              <Link
                href={`/reclamacoes/${reclamacao.protocolo}`}
                className="font-medium text-slate-900 hover:underline dark:text-slate-100"
              >
                {reclamacao.titulo}
              </Link>
            ) : (
              <p className="font-medium text-slate-400 dark:text-slate-500">
                {t("conteudoRemovido")}
              </p>
            )}
            {reclamacao && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{reclamacao.descricao}</p>
            )}

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("motivo")} <strong>{tMotivo(denuncia.motivo)}</strong> · {t("denunciadoPor")}{" "}
              {denuncia.denunciante.name ?? denuncia.denunciante.email} {t("em")}{" "}
              {denuncia.createdAt.toLocaleString(locale)}
            </p>
            {denuncia.descricao && (
              <p className="text-sm italic text-slate-600 dark:text-slate-400">
                “{denuncia.descricao}”
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <form action={marcarProcedente.bind(null, denuncia.id)}>
                <button type="submit" className={botaoPrimario}>
                  {t("procedente")}
                </button>
              </form>
              <form action={marcarImprocedente.bind(null, denuncia.id)}>
                <button type="submit" className={botaoSecundario}>
                  {t("improcedente")}
                </button>
              </form>

              {ehAdmin && (
                <form
                  action={banirAutor.bind(null, denuncia.id)}
                  className="flex items-center gap-2"
                >
                  <select
                    name="duracao"
                    defaultValue="7"
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="7">{t("seteDias")}</option>
                    <option value="30">{t("trintaDias")}</option>
                    <option value="permanente">{t("permanente")}</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {t("banirAutor")}
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}

      <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} basePath="/denuncias" />
    </main>
  );
}
