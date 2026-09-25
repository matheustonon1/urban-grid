import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { botaoPrimario, botaoSecundario, cartao, containerPagina } from "@/lib/estilos";

import { aprovarComentarioReprovado, confirmarRejeicaoComentario } from "./actions";
import { exigirModerador } from "../exigir-moderador";

export default async function ModeracaoComentariosPage({
  searchParams,
}: PageProps<"/moderacao/comentarios">) {
  const t = await getTranslations("ModeracaoComentarios");
  const tMod = await getTranslations("Moderacao");
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "COMENTARIO" as const, decisao: "REPROVAR" as const, revisadoEm: null };

  const [logsPendentes, totalPendentes] = await Promise.all([
    prisma.logModeracao.findMany({
      where: filtro,
      orderBy: { createdAt: "asc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
    }),
    prisma.logModeracao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalPendentes);

  const comentarios = logsPendentes.length
    ? await prisma.comentario.findMany({
        where: { id: { in: logsPendentes.map((log) => log.alvoId) } },
        include: { autor: true, reclamacao: { select: { protocolo: true, titulo: true } } },
      })
    : [];
  const comentarioPorId = new Map(comentarios.map((c) => [c.id, c]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <Link href="/moderacao/historico/comentarios" className="text-sm text-primary underline">
          {tMod("verHistorico")}
        </Link>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("descricao")}</p>

      {logsPendentes.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumPendente")}</p>
      )}

      {logsPendentes.map((log) => {
        const comentario = comentarioPorId.get(log.alvoId);
        if (!comentario) return null;

        return (
          <div key={log.id} className={`flex flex-col gap-2 ${cartao}`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {comentario.autor.name ?? comentario.autor.email} {t("em")}{" "}
              <Link
                href={`/reclamacoes/${comentario.reclamacao.protocolo}`}
                className="text-primary underline"
              >
                {comentario.reclamacao.titulo}
              </Link>
              {comentario.paiId && ` · ${t("respostaAOutroComentario")}`}
            </p>
            <p className="text-slate-800 dark:text-slate-200">{comentario.texto}</p>

            <div className="rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {tMod("analiseIA")}
              </p>
              <p className="text-amber-900 dark:text-amber-200">
                {tMod("ofensivo")} {log.scoreOfensivo?.toFixed(2)}
              </p>
              <p className="text-amber-900 dark:text-amber-200">
                {tMod("spam")} {log.scoreSpam?.toFixed(2)}
              </p>
              <p className="text-amber-900 dark:text-amber-200">
                {tMod("dadosPessoais")} {log.scoreDadosPessoais?.toFixed(2)}
              </p>
              {log.justificativa && (
                <p className="mt-1 italic text-amber-900 dark:text-amber-200">
                  {log.justificativa}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <form action={aprovarComentarioReprovado.bind(null, comentario.id)}>
                <button type="submit" className={botaoPrimario}>
                  {t("aprovarMesmoAssim")}
                </button>
              </form>
              <form action={confirmarRejeicaoComentario.bind(null, comentario.id)}>
                <button type="submit" className={botaoSecundario}>
                  {t("confirmarRejeicao")}
                </button>
              </form>
            </div>
          </div>
        );
      })}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/moderacao/comentarios"
      />
    </main>
  );
}
