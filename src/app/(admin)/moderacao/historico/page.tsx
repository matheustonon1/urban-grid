import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import { Paginacao } from "@/components/paginacao";
import { calcularSkip, calcularTotalPaginas, ITENS_POR_PAGINA, lerPaginaAtual } from "@/lib/paginacao";
import { containerPagina, cartao } from "@/lib/estilos";

import { exigirModerador } from "../exigir-moderador";

const DECISAO_ESTILO: Record<string, string> = {
  APROVAR: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  REPROVAR: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  ENCAMINHAR_REVISAO: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

export default async function HistoricoModeracaoPage({
  searchParams,
}: PageProps<"/moderacao/historico">) {
  const t = await getTranslations("HistoricoModeracao");
  const tDecisao = await getTranslations("Decisao");
  const locale = await getLocale();
  await exigirModerador();

  const { page } = await searchParams;
  const paginaAtual = lerPaginaAtual(page);
  const filtro = { alvoTipo: "RECLAMACAO" as const };

  const [logs, totalLogs] = await Promise.all([
    prisma.logModeracao.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      skip: calcularSkip(paginaAtual),
      take: ITENS_POR_PAGINA,
      include: { revisadoPor: true },
    }),
    prisma.logModeracao.count({ where: filtro }),
  ]);
  const totalPaginas = calcularTotalPaginas(totalLogs);

  const reclamacoes = logs.length
    ? await prisma.reclamacao.findMany({
        where: { id: { in: logs.map((log) => log.alvoId) } },
        select: { id: true, protocolo: true, titulo: true, status: true },
      })
    : [];
  const reclamacaoPorId = new Map(reclamacoes.map((r) => [r.id, r]));

  return (
    <main className={`${containerPagina} max-w-3xl`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("titulo")}
        </h1>
        <Link href="/moderacao/historico/comentarios" className="text-sm text-primary underline">
          {t("historicoComentarios")}
        </Link>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("decisoesDesc")}
        {totalLogs > 0 && ` (${totalLogs})`}.
      </p>

      {logs.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("nenhumaDecisao")}</p>
      )}

      {logs.map((log) => {
        const reclamacao = reclamacaoPorId.get(log.alvoId);

        return (
          <div key={log.id} className={`flex flex-col gap-2 ${cartao}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {reclamacao ? (
                  <Link
                    href={`/reclamacoes/${reclamacao.protocolo}`}
                    className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                  >
                    {reclamacao.titulo}
                  </Link>
                ) : (
                  <p className="font-medium text-slate-400 dark:text-slate-500">
                    {t("reclamacaoRemovida", { id: log.alvoId })}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {reclamacao?.protocolo} · {log.createdAt.toLocaleString(locale)} ·
                  {" "}v{log.versaoPrompt}
                  {log.latenciaMs != null && ` · ${log.latenciaMs}ms`}
                </p>
              </div>
              <span
                className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DECISAO_ESTILO[log.decisao]}`}
              >
                {tDecisao(log.decisao)} ({t("ia")})
              </span>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t("geral")} {log.scoreGeral.toFixed(2)} · {t("ofensivo")}: {log.scoreOfensivo?.toFixed(2)} ·
              {" "}{t("spam")}: {log.scoreSpam?.toFixed(2)} · {t("dadosPessoais")}: {log.scoreDadosPessoais?.toFixed(2)} ·
              {" "}{t("foraDeEscopo")}: {log.scoreForaEscopo?.toFixed(2)} · {t("desinformacao")}:{" "}
              {log.scoreDesinformacao?.toFixed(2)}
              {log.coerenciaTextoImagem !== null &&
                ` · ${t("coerenciaTextoImagem")}: ${log.coerenciaTextoImagem?.toFixed(2)}`}
            </p>

            {log.justificativa && (
              <p className="text-sm italic text-slate-600 dark:text-slate-400">
                “{log.justificativa}”
              </p>
            )}

            {log.decisaoFinal && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("revisadoPor")} {log.revisadoPor?.name ?? log.revisadoPor?.email ?? "—"} {t("em")}{" "}
                {log.revisadoEm?.toLocaleString(locale)} → {t("decisaoFinal")}:{" "}
                <span className="font-medium">{tDecisao(log.decisaoFinal)}</span>
              </p>
            )}
          </div>
        );
      })}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        basePath="/moderacao/historico"
      />
    </main>
  );
}
